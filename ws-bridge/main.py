"""
WebSocket Bridge Microservice

Subscribes to Redis pub/sub channels and broadcasts messages to connected WebSocket clients.
- orders:table:{table_id} (for customers)
- orders:tenant:{tenant_id} (for restaurant owners - orders)
- reservations:tenant:{tenant_id} (for restaurant owners - reservations)
"""
import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional
from urllib.parse import unquote

import httpx
import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from safe_logging import install_secret_redaction

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
install_secret_redaction()
logging.getLogger("httpx").setLevel(logging.WARNING)


# Store connected clients
# Key: "table:{table_id}" or "tenant:{tenant_id}"
table_connections: dict[int, set[WebSocket]] = {}  # table_id -> set of WebSockets
tenant_connections: dict[int, set[WebSocket]] = {}  # tenant_id -> set of WebSockets

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE_THIS_IN_PRODUCTION")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
API_URL = os.getenv("API_URL", "http://localhost:8020")


async def validate_table_token(table_token: str) -> Optional[dict]:
    """Validate table token by calling backend API."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{API_URL}/internal/validate-table/{table_token}")
            if response.status_code == 200:
                return response.json()
            return None
    except Exception as e:
        logger.error("Table token validation failed (%s)", type(e).__name__)
        return None


def validate_jwt_token(token: str) -> Optional[dict]:
    """Validate JWT token and extract tenant_id."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        tenant_id = payload.get("tenant_id")
        if tenant_id is None:
            return None
        return {"tenant_id": tenant_id, "email": payload.get("sub")}
    except JWTError:
        return None


async def redis_listener():
    """Subscribe to Redis and broadcast to WebSocket clients."""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    while True:
        try:
            r = redis.from_url(redis_url)
            pubsub = r.pubsub()
            
            # Subscribe to orders and reservations channels
            await pubsub.psubscribe("orders:table:*", "orders:tenant:*", "reservations:tenant:*")

            async for message in pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"].decode()
                    data = message["data"].decode()

                    # Parse channel: orders:table:{id}, orders:tenant:{id}, or reservations:tenant:{id}
                    parts = channel.split(":")
                    if len(parts) == 3:
                        channel_type = parts[1]  # "table" or "tenant"
                        entity_id = int(parts[2])
                        # orders:tenant:* and reservations:tenant:* both use tenant_connections

                        dead_connections = set()
                        
                        if channel_type == "table":
                            # Broadcast to all clients connected to this table
                            if entity_id in table_connections:
                                for ws in table_connections[entity_id]:
                                    try:
                                        await ws.send_text(data)
                                    except Exception:
                                        dead_connections.add(ws)
                                table_connections[entity_id] -= dead_connections
                        
                        elif channel_type == "tenant":
                            # Broadcast to all clients connected to this tenant
                            if entity_id in tenant_connections:
                                for ws in tenant_connections[entity_id]:
                                    try:
                                        await ws.send_text(data)
                                    except Exception:
                                        dead_connections.add(ws)
                                tenant_connections[entity_id] -= dead_connections
                        
        except Exception as e:
            logger.error("Redis connection error (%s)", type(e).__name__)
            await asyncio.sleep(5)  # Retry after 5 seconds


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start Redis listener on startup
    task = asyncio.create_task(redis_listener())
    yield
    task.cancel()


app_base = FastAPI(title="WS Bridge", lifespan=lifespan)


# Log neither request headers/query strings nor table tokens.
# Uvicorn access logs are disabled by start.py for the same reason.
cors_origins_str = os.getenv("CORS_ORIGINS", "*")
allow_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]
is_production = os.getenv("PRODUCTION", "").lower() in ("true", "1")
if is_production:
    if not SECRET_KEY or SECRET_KEY.upper().startswith("CHANGE_THIS"):
        raise RuntimeError("Production WebSocket bridge requires SECRET_KEY")
    if not allow_origins or "*" in allow_origins:
        raise RuntimeError("Production WebSocket bridge requires explicit CORS_ORIGINS")
    if not os.getenv("REDIS_URL"):
        raise RuntimeError("Production WebSocket bridge requires REDIS_URL")
    if not os.getenv("API_URL"):
        raise RuntimeError("Production WebSocket bridge requires API_URL")

app_base.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app = app_base


@app_base.get("/health")
async def health():
    if is_production:
        try:
            async with redis.from_url(os.environ["REDIS_URL"], socket_connect_timeout=3, socket_timeout=3) as client:
                await client.ping()
        except Exception:
            raise HTTPException(status_code=503, detail="Realtime service unavailable") from None
    table_count = sum(len(c) for c in table_connections.values())
    tenant_count = sum(len(c) for c in tenant_connections.values())
    return {
        "status": "ok",
        "table_connections": table_count,
        "tenant_connections": tenant_count,
        "total_connections": table_count + tenant_count,
        "config": {
            "api_url_configured": bool(API_URL),
            "secret_key_configured": bool(SECRET_KEY and SECRET_KEY != "CHANGE_THIS_IN_PRODUCTION"),
            "algorithm": ALGORITHM
        }
    }


@app_base.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def catch_all(request: Request, path: str):
    """Catch-all route to log unmatched requests."""
    
    return JSONResponse(
        status_code=404,
        content={
            "detail": "Endpoint not found",
            "available_endpoints": [
                "/health",
                "/ws/table/{table_token}",
                "/ws/tenant/{tenant_id}?token=..."
            ]
        }
    )


@app_base.websocket("/ws/table/{table_token}")
@app_base.websocket("/table/{table_token}")  # Also accept without /ws prefix (for HAProxy)
async def websocket_table_endpoint(websocket: WebSocket, table_token: str):
    """WebSocket endpoint for customers - validates table_token and only sends table-specific updates."""
    client_host = websocket.client.host if websocket.client else "unknown"
    logger.info("Table WebSocket connection attempt from %s", client_host)
    
    try:
        await websocket.accept()
    except Exception as e:
        logger.error("Failed to accept table WebSocket connection (%s)", type(e).__name__)
        return
    
    # Validate table token
    table_info = await validate_table_token(table_token)
    if not table_info:
        logger.warning("Invalid table token from %s", client_host)
        await websocket.close(code=1008, reason="Invalid table token")
        return
    
    table_id = table_info["table_id"]
    
    # Add to connections
    if table_id not in table_connections:
        table_connections[table_id] = set()
    table_connections[table_id].add(websocket)
    
    try:
        while True:
            # Keep connection alive, handle any incoming messages
            data = await websocket.receive_text()
            # Could handle client messages here if needed (e.g., ping/pong)
    except WebSocketDisconnect:
        pass
    finally:
        # Remove from connections
        if table_id in table_connections:
            table_connections[table_id].discard(websocket)
            if not table_connections[table_id]:
                del table_connections[table_id]


def _get_ws_token(websocket: WebSocket) -> Optional[str]:
    """Get token from query string or cookie; avoid Query() which can cause 403 before accept()."""
    # Query params from scope (reliable for WebSocket handshake)
    query_string = websocket.scope.get("query_string", b"").decode("utf-8", errors="replace")
    if query_string:
        for part in query_string.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                if k.strip().lower() == "token":
                    return unquote(v.strip()) or None
    return websocket.cookies.get("access_token")


@app_base.websocket("/ws/tenant/{tenant_id}")
@app_base.websocket("/tenant/{tenant_id}")  # Also accept without /ws prefix (for HAProxy)
async def websocket_tenant_endpoint(websocket: WebSocket, tenant_id: int):
    """WebSocket endpoint for restaurant owners - requires JWT authentication."""
    client_host = websocket.client.host if websocket.client else "unknown"
    token = _get_ws_token(websocket)
    logger.info(f"WebSocket connection attempt: /ws/tenant/{tenant_id} from {client_host} (token present: {bool(token)})")

    try:
        await websocket.accept()
    except Exception as e:
        logger.error(f"Failed to accept WebSocket connection for /ws/tenant/{tenant_id}: {e}")
        return

    # Validate after accept(); reject with close(1008) so client sees auth failure, not 403
    if not token:
        logger.warning(f"WebSocket /ws/tenant/{tenant_id}: Missing token from {client_host}")
        await websocket.close(code=1008, reason="Missing authentication token")
        return

    token_info = validate_jwt_token(token)
    if not token_info:
        logger.warning(
            f"WebSocket /ws/tenant/{tenant_id}: Invalid token from {client_host} "
            f"(SECRET_KEY configured: {bool(SECRET_KEY and SECRET_KEY != 'CHANGE_THIS_IN_PRODUCTION')})"
        )
        await websocket.close(code=1008, reason="Invalid authentication token")
        return

    if token_info["tenant_id"] != tenant_id:
        logger.warning(
            f"WebSocket /ws/tenant/{tenant_id}: Tenant ID mismatch from {client_host} "
            f"(token has {token_info['tenant_id']})"
        )
        await websocket.close(code=1008, reason="Tenant ID mismatch")
        return

    logger.info(f"WebSocket /ws/tenant/{tenant_id}: Successfully authenticated for tenant {tenant_id} from {client_host}")

    # Add to connections
    if tenant_id not in tenant_connections:
        tenant_connections[tenant_id] = set()
    tenant_connections[tenant_id].add(websocket)

    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if tenant_id in tenant_connections:
            tenant_connections[tenant_id].discard(websocket)
            if not tenant_connections[tenant_id]:
                del tenant_connections[tenant_id]


