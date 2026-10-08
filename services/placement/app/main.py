from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.admin import Conflict, NotFound
from app.routers import admin, public

app = FastAPI(title="Placement service")
app.include_router(public.router)
app.include_router(admin.router)


@app.exception_handler(NotFound)
async def not_found_handler(request: Request, exc: NotFound):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(Conflict)
async def conflict_handler(request: Request, exc: Conflict):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.get("/health")
async def health():
    return {"status": "ok"}