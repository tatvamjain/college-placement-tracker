from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.db import engine

app=FastAPI(title="Auth Service", version="0.1.0")

@app.get("/health/live")
async def live()-> dict[str,str]:
    return {"status":"ok"}

@app.get("/health/ready")
async def ready() -> JSONResponse:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return JSONResponse(status_code=200, content={"status": "ready"})