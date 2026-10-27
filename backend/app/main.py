import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.routes import health, wind
from seed_data import ensure_seeded

logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("wind_evaluation")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing UK Wind Forecast Evaluation Service...")
    # Ensure database is pre-seeded with January 2026 data
    try:
        ensure_seeded()
    except Exception as e:
        logger.error(f"Failed to verify/seed database: {e}", exc_info=True)
    yield
    logger.info("Shutting down Wind Forecast Evaluation Service.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Decision-support portal for UK day-ahead wind forecast evaluation against Elexon BMRS actuals (January 2026).",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(health.router)
app.include_router(wind.router)


@app.get("/")
def root():
    return {
        "portal": "UK National Wind Forecast Evaluation Portal",
        "version": settings.app_version,
        "docs_url": "/docs",
        "health_url": "/api/health",
        "summary_url": "/api/wind/summary?month=2026-01&gate=d1_1200"
    }
