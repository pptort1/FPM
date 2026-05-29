from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/fpm"
    CORS_ORIGINS: str = "http://localhost:5173"
    BSALE_TOKEN: str = ""
    SECRET_KEY: str = "cambia-esto-en-produccion-ahora"
    ADMIN_PASSWORD: str = "admin123"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"

settings = Settings()
