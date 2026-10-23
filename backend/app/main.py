from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import maps, routes, scenarios
from app.models.schemas import HealthResponse

app = FastAPI(
    title="NaviExit API",
    version="0.1.0",
    description="가상 공간과 가정값을 사용하는 대피경로 비교 프로토타입 API",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.include_router(maps.router)
app.include_router(scenarios.router)
app.include_router(routes.router)


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="naviexit-backend")
