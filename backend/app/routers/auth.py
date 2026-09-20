from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import criar_token
from app.database import get_db
from app.models import Aluno, Turma
from app.schemas import AlunoOut, LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    aluno = (
        db.query(Aluno)
        .join(Turma)
        .filter(Aluno.rm == payload.rm.strip(), Turma.nome == payload.turma.strip().upper())
        .first()
    )
    if not aluno:
        raise HTTPException(status_code=401, detail="RM ou turma incorretos")

    token = criar_token(aluno.id)
    return LoginResponse(
        access_token=token,
        aluno=AlunoOut(id=aluno.id, rm=aluno.rm, nome=aluno.nome, turma=aluno.turma.nome),
    )
