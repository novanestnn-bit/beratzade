-- Public upload durability only. No existing restaurant or media rows are changed.
CREATE TABLE IF NOT EXISTS uploaded_media (
    relative_path TEXT PRIMARY KEY CHECK (char_length(relative_path) <= 1024),
    content BYTEA NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 5242880),
    content_type VARCHAR(64) NOT NULL,
    sha256 VARCHAR(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
