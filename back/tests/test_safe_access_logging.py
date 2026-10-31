import logging
from app.safe_logging import redact_access


def test_access_log_redacts_table_and_staff_credentials():
    record = logging.LogRecord('uvicorn.access', logging.INFO, '', 1, '%s - "%s %s HTTP/%s" %d', ('127.0.0.1', 'GET', '/menu/private-table?staff_access=private-jwt&lang=tr', '1.1', 200), None)
    assert redact_access(record)
    message = record.getMessage()
    assert 'private-table' not in message
    assert 'private-jwt' not in message
    assert 'lang=tr' in message


def test_access_log_preserves_health_requests():
    record = logging.LogRecord('uvicorn.access', logging.INFO, '', 1, '%s - "%s %s HTTP/%s" %d', ('127.0.0.1', 'GET', '/health/db', '1.1', 200), None)
    assert redact_access(record)
    assert '/health/db' in record.getMessage()
