"""Uvicorn logs WebSocket handshakes even when HTTP access logs are disabled."""
import logging
import re


class SecretRedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        message = re.sub(r'(/[^\s"?]+)\?[^\s"]+', r'\1?[redacted]', message)
        message = re.sub(r'(/(?:ws/)?table/)[^\s"?]+', r'\1[redacted]', message)
        record.msg = message
        record.args = ()
        return True


def install_secret_redaction() -> None:
    for name in ('uvicorn.error', 'uvicorn.access'):
        logging.getLogger(name).addFilter(SecretRedactionFilter())
    for handler in logging.getLogger().handlers:
        handler.addFilter(SecretRedactionFilter())
