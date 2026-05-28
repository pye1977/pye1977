"""RIVITED Solutions — main FastAPI application."""
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from auth import router as auth_router, seed_admin  # noqa: E402
from database import close_db, ensure_indexes  # noqa: E402
from routes_ai import router as ai_router  # noqa: E402
from routes_content import router as content_router  # noqa: E402
from routes_finance import router as finance_router  # noqa: E402
from routes_rights import router as rights_router  # noqa: E402
from seed import seed_demo_data  # noqa: E402


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
log = logging.getLogger("rivited")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    await seed_admin()
    await seed_demo_data()
    log.info("RIVITED Solutions backend started")
    yield
    await close_db()


app = FastAPI(title="RIVITED Solutions API", lifespan=lifespan)

# CORS — supports cookies via httpOnly + samesite=none on prod
_frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000")
_origins = [_frontend, "http://localhost:3000", "http://localhost:3001"]
# Also allow comma-separated CORS_ORIGINS override
_extra = os.environ.get("CORS_ORIGINS", "")
if _extra and _extra != "*":
    _origins.extend([o.strip() for o in _extra.split(",") if o.strip()])
app.add_middleware(
    CORSMiddleware,
    allow_origins=list({o for o in _origins if o}),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "service": "rivited-solutions"}


@app.get("/api/")
async def root() -> dict:
    return {
        "service": "RIVITED Solutions",
        "tagline": "Programmable Production Finance OS for Vertical Media",
    }


app.include_router(auth_router)
app.include_router(finance_router)
app.include_router(rights_router)
app.include_router(content_router)
app.include_router(ai_router)
