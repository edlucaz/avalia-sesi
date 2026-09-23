from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import Base, engine
from app.routers import auth, professor, questoes, simulados, tentativas

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Avalia SESI — Plataforma de Simulados", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(simulados.router)
app.include_router(tentativas.router)
app.include_router(professor.router)
app.include_router(questoes.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
