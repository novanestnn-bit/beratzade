"""Durable public restaurant images; the uploads directory is a rebuildable cache.

Mutation callers must authorize the owning tenant/provider and commit their own
transaction. Contract documents and arbitrary upload paths are never accepted.
"""
from __future__ import annotations

from hashlib import sha256
from io import BytesIO
import logging
import os
from pathlib import Path
import re
import tempfile
import warnings

from PIL import Image, UnidentifiedImageError
from sqlalchemy import text

from .svg_sanitize import SvgSanitizeError, sanitize_svg

MAX_MEDIA_BYTES = 5 * 1024 * 1024  # Same upper bound as authenticated image uploads.
_PATH = re.compile(
    r"(?:[1-9][0-9]*/(?:logo|header|products)|providers/[A-Za-z0-9_-]{1,160}/products)"
    r"/[A-Za-z0-9][A-Za-z0-9_.-]{0,240}\.(?:jpg|jpeg|png|webp|avif|svg)\Z",
    re.IGNORECASE,
)
_MIME = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp", "AVIF": "image/avif"}
_LOG = logging.getLogger(__name__)


def _public_path(uploads_root: Path, path: Path) -> tuple[Path, str]:
    root = Path(uploads_root).resolve()
    candidate = Path(path)
    if not candidate.is_absolute():
        candidate = root / candidate
    try:
        relative = candidate.relative_to(root)
    except ValueError:
        raise ValueError("Image path must stay within uploads") from None
    if any(part in (".", "..") or "\\" in part for part in relative.parts):
        raise ValueError("Image path is not canonical")
    name = relative.as_posix()
    if len(name) > 1024 or not _PATH.fullmatch(name):
        raise ValueError("Only public restaurant image paths are supported")
    # Reject symlink aliases too: they could target contracts or another upload.
    resolved = candidate.resolve()
    if resolved != root / relative:
        raise ValueError("Image path must not traverse symlinks")
    return resolved, name


def _content_type(relative_path: str, contents: bytes) -> str:
    if not contents or len(contents) > MAX_MEDIA_BYTES:
        raise ValueError("Image content exceeds the allowed size")
    if relative_path.lower().endswith(".svg"):
        if not re.fullmatch(r"[1-9][0-9]*/logo/[^/]+\.svg", relative_path, re.IGNORECASE):
            raise ValueError("SVG is allowed only for tenant logos")
        try:
            if sanitize_svg(contents) != contents:
                raise ValueError("Logo SVG must be sanitized before persistence")
        except SvgSanitizeError:
            raise ValueError("Unsafe logo SVG") from None
        return "image/svg+xml"
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(contents)) as image:
                mime = _MIME.get(image.format)
                if not mime:
                    raise ValueError("Unsupported raster image format")
                image.verify()
                return mime
    except (UnidentifiedImageError, OSError, SyntaxError, EOFError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValueError("Invalid raster image") from None


def persist_upload(session, uploads_root: Path, path: Path, contents: bytes) -> None:
    """Upsert verified public image bytes in the caller's transaction; never commit."""
    _, relative = _public_path(uploads_root, path)
    mime = _content_type(relative, contents)
    session.execute(text("""
        INSERT INTO uploaded_media (relative_path, content, content_type, sha256, updated_at)
        VALUES (:path, :content, :content_type, :sha256, CURRENT_TIMESTAMP)
        ON CONFLICT (relative_path) DO UPDATE SET
            content = EXCLUDED.content, content_type = EXCLUDED.content_type,
            sha256 = EXCLUDED.sha256, updated_at = CURRENT_TIMESTAMP
        WHERE uploaded_media.sha256 IS DISTINCT FROM EXCLUDED.sha256
           OR uploaded_media.content_type IS DISTINCT FROM EXCLUDED.content_type
    """), {"path": relative, "content": contents, "content_type": mime, "sha256": sha256(contents).hexdigest()})


def remove_upload(session, uploads_root: Path, path: Path) -> None:
    """Remove the durable record; caller owns authorization, cache unlink and commit."""
    _, relative = _public_path(uploads_root, path)
    session.execute(text("DELETE FROM uploaded_media WHERE relative_path = :path"), {"path": relative})


def restore_uploads(engine, uploads_root: Path) -> int:
    """Hydrate valid public image cache entries one row at a time, without DB writes."""
    root = Path(uploads_root).resolve()
    restored = 0
    with engine.connect() as connection:
        rows = connection.execute(text(
            "SELECT relative_path, content, content_type, sha256 FROM uploaded_media ORDER BY relative_path"
        ), execution_options={"stream_results": True, "max_row_buffer": 1}).yield_per(1)
        for row in rows:
            try:
                target, relative = _public_path(root, Path(row.relative_path))
                contents = bytes(row.content)
                if sha256(contents).hexdigest() != row.sha256 or _content_type(relative, contents) != row.content_type:
                    raise ValueError("Stored image integrity check failed")
            except (ValueError, TypeError):
                _LOG.warning("Skipped invalid durable public image; no cache file written")
                continue
            if target.is_file() and target.stat().st_size == len(contents):
                with target.open("rb") as current:
                    digest = sha256()
                    for chunk in iter(lambda: current.read(65536), b""):
                        digest.update(chunk)
                if digest.hexdigest() == row.sha256:
                    continue
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=target.parent, prefix=".media-", delete=False) as cache:
                    temporary = Path(cache.name)
                    cache.write(contents)
                    cache.flush()
                    os.fsync(cache.fileno())
                _public_path(root, target)
                temporary.replace(target)
                restored += 1
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
    return restored
