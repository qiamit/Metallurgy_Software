from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.core.database import init_db
from app.routers import analysis, auth, calibrations
from app.services.storage import storage

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(settings.local_storage_path).mkdir(parents=True, exist_ok=True)
    await init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(calibrations.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "metallurgy-api"}


@app.get("/files/{file_path:path}")
async def get_file(file_path: str):
    if settings.storage_backend == "s3" and storage._s3:
        try:
            data = storage.read_bytes(file_path)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=404, detail="File not found") from exc
        from fastapi.responses import Response

        return Response(content=data, media_type="application/octet-stream")
    path = storage.absolute_path(file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)
