from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
from unittest.mock import AsyncMock, patch
import logging

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from safe_logging import SecretRedactionFilter


def load_bridge(monkeypatch, production=False):
    monkeypatch.setenv('PRODUCTION', 'true' if production else 'false')
    spec = spec_from_file_location('readiness_bridge', Path(__file__).with_name('main.py'))
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_logs_and_error_response_do_not_echo_credentials(monkeypatch, caplog):
    bridge = load_bridge(monkeypatch)
    client = TestClient(bridge.app)
    response = client.get('/missing', params={'token': 'synthetic-private-marker'}, headers={'Authorization': 'synthetic-private-marker'})
    assert response.status_code == 404
    assert 'synthetic-private-marker' not in response.text
    with patch.object(bridge, 'validate_table_token', AsyncMock(return_value=None)):
        with client.websocket_connect('/ws/table/synthetic-private-marker') as websocket:
            with pytest.raises(WebSocketDisconnect):
                websocket.receive_text()
    assert 'synthetic-private-marker' not in caplog.text


def test_production_requires_secret_configuration(monkeypatch):
    monkeypatch.delenv('SECRET_KEY', raising=False)
    with pytest.raises(RuntimeError, match='SECRET_KEY'):
        load_bridge(monkeypatch, production=True)


def test_production_rejects_wildcard_cors(monkeypatch):
    monkeypatch.setenv('SECRET_KEY', 'synthetic-local-test-secret')
    monkeypatch.setenv('CORS_ORIGINS', '*')
    with pytest.raises(RuntimeError, match='CORS_ORIGINS'):
        load_bridge(monkeypatch, production=True)


def test_production_health_checks_redis(monkeypatch):
    monkeypatch.setenv('SECRET_KEY', 'synthetic-local-test-secret')
    monkeypatch.setenv('CORS_ORIGINS', 'https://frontend.invalid')
    monkeypatch.setenv('API_URL', 'http://backend.invalid')
    monkeypatch.setenv('REDIS_URL', 'redis://unreachable.invalid:6379')
    bridge = load_bridge(monkeypatch, production=True)
    with patch.object(bridge.redis, 'from_url', side_effect=ConnectionError):
        response = TestClient(bridge.app).get('/health')
    assert response.status_code == 503
    assert response.json() == {'detail': 'Realtime service unavailable'}


@pytest.mark.parametrize('message', [
    'WebSocket /ws/tenant/1?token=synthetic-private-marker accepted',
    'WebSocket /ws/table/synthetic-private-marker?token=another-marker accepted',
    'Request https://backend.invalid/ws?token=synthetic-private-marker accepted',
])
def test_uvicorn_handshake_logs_redact_tokens(message):
    record = logging.LogRecord('uvicorn.error', logging.INFO, '', 0, '%s', (message,), None)
    SecretRedactionFilter().filter(record)
    assert 'synthetic-private-marker' not in record.getMessage()
    assert 'another-marker' not in record.getMessage()
    assert '[redacted]' in record.getMessage()
