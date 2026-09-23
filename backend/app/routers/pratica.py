import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import aluno_atual
from app.database import get_db
from app.models import Aluno, PraticaRegistro, Questao
from app.schemas import QuestaoTreino, ResponderTreinoRequest, ResultadoTreino

router = APIRouter(prefix="/api/pratica", tags=["pratica"])


@router.get("/proxima", response_model=QuestaoTreino)
def proxima_questao(
    disciplina: str | None = None,
    aluno: Aluno = Depends(aluno_atual),
    db: Session = Depends(get_db),
):
    query = db.query(Questao).filter(Questao.etapa == aluno.turma.etapa)
    if disciplina:
        query = query.filter(Questao.disciplina == disciplina)
    banco = query.all()
    if not banco:
        raise HTTPException(status_code=404, detail="Não há questões disponíveis para praticar")

    questao = random.choice(banco)
    return QuestaoTreino(
        questao_id=questao.id,
        disciplina=questao.disciplina.value,
        enunciado=questao.enunciado,
        alternativas=questao.alternativas,
        tem_imagem=bool(questao.imagem_url),
    )


@router.post("/responder", response_model=ResultadoTreino)
def responder_treino(
    payload: ResponderTreinoRequest,
    aluno: Aluno = Depends(aluno_atual),
    db: Session = Depends(get_db),
):
    questao = db.query(Questao).filter(Questao.id == payload.questao_id).first()
    if not questao:
        raise HTTPException(status_code=404, detail="Questão não encontrada")

    acerto = payload.alternativa_marcada == questao.gabarito
    registro = PraticaRegistro(
        aluno_id=aluno.id,
        questao_id=questao.id,
        alternativa_marcada=payload.alternativa_marcada,
        acerto=acerto,
        criado_em=datetime.utcnow(),
    )
    db.add(registro)
    db.commit()

    return ResultadoTreino(
        questao_id=questao.id,
        gabarito=questao.gabarito,
        alternativa_marcada=payload.alternativa_marcada,
        acerto=acerto,
        descritor=questao.descritor,
        comentario_pedagogico=questao.comentario_pedagogico,
    )
