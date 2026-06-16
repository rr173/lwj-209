from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import engine, Base
from routers import product_lines, versions, batches, exclusion_groups, analytics, costs, stability, approvals


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    from seed import seed_database
    await seed_database()
    yield


app = FastAPI(title="化妆品配方版本管理与批次追溯系统", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(product_lines.router)
app.include_router(versions.router)
app.include_router(batches.router)
app.include_router(exclusion_groups.router)
app.include_router(analytics.router)
app.include_router(costs.router)
app.include_router(stability.router)
app.include_router(approvals.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
