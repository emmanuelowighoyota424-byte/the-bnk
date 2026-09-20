from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # JWT Settings
    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # SSO / JWKS (for Auth0, Okta, Entra ID)
    JWKS_URL: str | None = None
    ISSUER: str | None = None

    # Liveness Thresholds
    DEFAULT_LIVENESS_THRESHOLD: float = 0.75
    HIGH_RISK_THRESHOLD: float = 0.65

    # Multi-tenant
    DEFAULT_ORG_ID: str = "default"

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://user:password@localhost/voice_liveness_db"

    # Optional enterprise fallback
    PINDROP_API_KEY: str | None = None

    class Config:
        env_file = ".env"


settings = Settings()
