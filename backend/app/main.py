from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.db.firestore import store
from app.routes import allocation, system, task, volunteer
from app.services.optimizer import bootstrap_demo_state, current_priority_config

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@asynccontextmanager
async def lifespan(_: FastAPI):
    bootstrap_demo_state()
    current_priority_config()
    yield


app = FastAPI(
    title="HopeNet API",
    description="Real-time adaptive volunteer allocation with simulation and explainability.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(volunteer.router, prefix="/api/volunteers", tags=["volunteers"])
app.include_router(task.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(allocation.router, prefix="/api/allocation", tags=["allocation"])
app.include_router(system.router, prefix="/api/system", tags=["system"])


@app.get("/health")
def healthcheck():
    return {
        "status": "ok",
        "database": "firestore" if store.firestore_enabled else "in-memory",
        "collection_prefix": store.collection_prefix,
    }
