from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "WealthOS API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://wealthos:wealthos@localhost:5432/wealthos"
    jwt_secret: str = "development-only-change-before-deploy"
    access_token_minutes: int = 60 * 24 * 7
    frontend_origins: str = "http://localhost:3000"
    paypal_client_id: str | None = None
    paypal_client_secret: str | None = None
    paypal_webhook_id: str | None = None
    paypal_environment: str = "sandbox"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def paypal_base_url(self) -> str:
        return "https://api-m.paypal.com" if self.paypal_environment == "live" else "https://api-m.sandbox.paypal.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
