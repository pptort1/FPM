from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select
from ..database import get_db
from ..models import Usuario
from ..auth import verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    token: str
    username: str
    nombre: str | None


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.execute(
        select(Usuario).where(Usuario.username == body.username)
    ).scalar_one_or_none()

    if not user or not user.activo or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario o contraseña incorrectos")

    return LoginOut(
        token=create_token(user.username),
        username=user.username,
        nombre=user.nombre,
    )


@router.get("/me")
def me(user: Usuario = Depends(get_current_user)):
    return {"username": user.username, "nombre": user.nombre}
