"""An HTTP-only installation must enforce limits without requiring Redis."""
import os
import subprocess
import sys


def test_missing_redis_uses_memory_and_still_returns_429():
    env = dict(os.environ)
    env.pop('REDIS_URL', None)
    env['RATE_LIMIT_REDIS_URL'] = ''
    env['RATE_LIMIT_ENABLED'] = 'true'
    script = '''
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from limits.storage import MemoryStorage
from app.rate_limits import limiter, register_rate_limit_exception_handler
assert isinstance(limiter._storage, MemoryStorage)
app = FastAPI()
register_rate_limit_exception_handler(app)
@app.get('/limited')
@limiter.limit('2/minute')
def limited(request: Request, response: Response):
    return JSONResponse({'ok': True})
with TestClient(app) as client:
    assert [client.get('/limited').status_code for _ in range(3)] == [200, 200, 429]
'''
    result = subprocess.run([sys.executable, '-c', script], env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
