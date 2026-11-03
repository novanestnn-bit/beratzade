"""Public media survives an ephemeral filesystem without copying private uploads."""
from contextlib import nullcontext
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from PIL import Image
from sqlalchemy import text

from pg_client_mixin import PgClientTestCase
from app.media_storage import MAX_MEDIA_BYTES, persist_upload, remove_upload, restore_uploads
from app.svg_sanitize import sanitize_svg


def png(color="red"):
    output = BytesIO()
    Image.new("RGB", (2, 2), color).save(output, format="PNG")
    return output.getvalue()


class TestMediaStorage(PgClientTestCase):
    def setUp(self):
        super().setUp()
        migration = Path(__file__).parent.parent / "migrations/20261103230000_persistent_media.sql"
        self.connection.execute(text(migration.read_text(encoding="utf-8")))
        self.directory = TemporaryDirectory()
        self.root = Path(self.directory.name)
        # Share the outer rollback transaction so tests never commit fixture media.
        self.bound_engine = SimpleNamespace(connect=lambda: nullcontext(self.connection))

    def tearDown(self):
        self.directory.cleanup()
        super().tearDown()

    def test_restore_exact_bytes_after_filesystem_loss_and_idempotent_repeat(self):
        contents = png()
        path = self.root / "998812/products/dish.png"
        persist_upload(self.session, self.root, path, contents)
        path.parent.mkdir(parents=True)
        path.write_bytes(contents)
        path.unlink()
        self.assertEqual(restore_uploads(self.bound_engine, self.root), 1)
        self.assertEqual(path.read_bytes(), contents)
        self.assertEqual(restore_uploads(self.bound_engine, self.root), 0)

    def test_upsert_and_caller_rollback(self):
        path = self.root / "998812/products/dish.png"
        persist_upload(self.session, self.root, path, png())
        replacement = png("blue")
        persist_upload(self.session, self.root, path, replacement)
        row = self.session.execute(text("SELECT content FROM uploaded_media WHERE relative_path = '998812/products/dish.png'")).one()
        self.assertEqual(bytes(row.content), replacement)
        self.session.rollback()
        self.assertIsNone(self.connection.execute(text("SELECT 1 FROM uploaded_media WHERE relative_path = '998812/products/dish.png'")).first())

    def test_rejects_contracts_private_traversal_and_unsupported_extensions(self):
        for path in ["998812/contracts/signature.png", "998812/private/photo.png", "../998812/products/dish.png", "998812/products/../logo/dish.png", "providers/../../private/photo.png", "998812/products/dish.pdf"]:
            with self.subTest(path=path), self.assertRaises(ValueError):
                persist_upload(self.session, self.root, Path(path), png())
        with self.assertRaises(ValueError):
            persist_upload(self.session, self.root, self.root.parent / "outside.png", png())

    def test_rejects_invalid_and_oversized_content(self):
        path = self.root / "998812/products/dish.png"
        for contents in [b"not an image", b"", b"x" * (MAX_MEDIA_BYTES + 1)]:
            with self.assertRaises(ValueError):
                persist_upload(self.session, self.root, path, contents)

    def test_svg_only_accepts_already_sanitized_tenant_logos(self):
        clean = sanitize_svg(b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" /></svg>')
        persist_upload(self.session, self.root, Path("998812/logo/brand.svg"), clean)
        self.assertEqual(restore_uploads(self.bound_engine, self.root), 1)
        self.assertEqual((self.root / "998812/logo/brand.svg").read_bytes(), clean)
        for path in ["998812/products/brand.svg", "providers/public-token/products/brand.svg"]:
            with self.assertRaises(ValueError):
                persist_upload(self.session, self.root, Path(path), clean)
        with self.assertRaises(ValueError):
            persist_upload(self.session, self.root, Path("998812/logo/unsafe.svg"), b'<svg><script>x</script></svg>')

    def test_provider_raster_and_remove_respect_caller_transaction(self):
        path = Path("providers/public-token/products/dish.png")
        persist_upload(self.session, self.root, path, png())
        self.assertEqual(restore_uploads(self.bound_engine, self.root), 1)
        remove_upload(self.session, self.root, path)
        (self.root / path).unlink()
        self.assertEqual(restore_uploads(self.bound_engine, self.root), 0)

    def test_restore_rejects_corrupt_or_private_rows(self):
        contents = png()
        for relative, digest in [("998812/products/corrupt.png", "0" * 64), ("998812/contracts/private.png", sha256(contents).hexdigest()), ("../escape.png", sha256(contents).hexdigest())]:
            self.session.execute(text("INSERT INTO uploaded_media(relative_path,content,content_type,sha256) VALUES (:path,:content,'image/png',:hash)"), {"path": relative, "content": contents, "hash": digest})
        self.assertEqual(restore_uploads(self.bound_engine, self.root), 0)
        self.assertFalse((self.root / "998812").exists())
        self.assertFalse((self.root.parent / "escape.png").exists())
