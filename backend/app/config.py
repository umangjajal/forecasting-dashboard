from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    app_name: str = "UK Wind Forecast Evaluation API"
    app_version: str = "1.0.0"
    debug: bool = False
    
    port: int = 8000
    host: str = "0.0.0.0"
    
    # Elexon BMRS API
    elexon_api_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    elexon_request_timeout_seconds: float = 25.0
    elexon_max_retries: int = 3
    elexon_backoff_factor: float = 1.5
    
    # Storage
    database_url: str = "sqlite:///./data/wind_evaluation.db"
    database_path: str = "./data/wind_evaluation.db"
    
    # CORS
    cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "https://localhost:3000",
            "*"
        ]
    )

    # Evaluation Defaults
    evaluation_month: str = "2026-01"
    default_gate: str = "d1_1200"


settings = Settings()
