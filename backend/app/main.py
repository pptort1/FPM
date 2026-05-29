from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .auth import get_current_user
from .routers import egresos, ingresos, flujo, cartolas, bsale, auth, proveedores, egresos_manual, ingresos_bsale, ingresos_tuu

app = FastAPI(title="FPM Finanzas API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas públicas (sin auth)
app.include_router(auth.router)

# Rutas protegidas — requieren Bearer token válido
PROTECTED = {"dependencies": [Depends(get_current_user)]}
app.include_router(egresos.router,  **PROTECTED)
app.include_router(ingresos.router, **PROTECTED)
app.include_router(flujo.router,    **PROTECTED)
app.include_router(cartolas.router, **PROTECTED)
app.include_router(bsale.router,       **PROTECTED)
app.include_router(proveedores.router,    **PROTECTED)
app.include_router(egresos_manual.router,  **PROTECTED)
app.include_router(ingresos_bsale.router,  **PROTECTED)
app.include_router(ingresos_tuu.router,    **PROTECTED)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
