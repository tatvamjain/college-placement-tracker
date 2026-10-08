from fastapi import FastAPI

from app.routers import public

app = FastAPI(title="Placement service")
app.include_router(public.router)


@app.get("/health")
async def health():
    return {"status": "ok"}