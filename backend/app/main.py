from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import egresos, ingresos, flujo

app = FastAPI(title="FPM Finanzas API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(egresos.router)
app.include_router(ingresos.router)
app.include_router(flujo.router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
