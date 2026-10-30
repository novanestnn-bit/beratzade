"""Render entrypoint; disable access logs because WebSocket URLs contain tokens."""
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8021"))
    if not 1 <= port <= 65535:
        raise ValueError("PORT must be between 1 and 65535")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False, access_log=False)
