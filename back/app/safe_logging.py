"""Keep table credentials out of ordinary HTTP access logs."""
import logging
import re


def redact_access(record):
    if isinstance(record.args, tuple) and len(record.args) == 5:
        args = list(record.args)
        path = re.sub(r'(/menu/)[^/? ]+', r'\1[redacted]', str(args[2]))
        path = re.sub(r'([?&](?:staff_access|token|access_token)=)[^& ]+', r'\1[redacted]', path)
        args[2] = path
        record.args = tuple(args)
    return True


def configure_access_redaction():
    logger = logging.getLogger('uvicorn.access')
    if redact_access not in logger.filters:
        logger.addFilter(redact_access)
