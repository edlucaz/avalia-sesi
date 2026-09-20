from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import aluno_atual
from app.database import get_db
from app.models import Aluno, Simulado, StatusTentativa, Tentativa
from app.schemas import SimuladoResumo

router = APIRouter(prefix="/api/simulados", tags=["simulados"])


@router.get("", response_model=list[SimuladoResumo])
def listar_simulados(
    aluno: Aluno = Depends(aluno_atual),
    db: Session = Depends(get_db),
):
    agora = datetime.utcnow()
    simulados = (
        db.query(Simulado)
        .filter(Simulado.turmas_alvo.any(id=aluno.turma_id))
        .filter(Simulado.janela_inicio <= agora, Simulado.janela_fim >= agora)
        .all()
    )

    resultado = []
    for simulado in simulados:
        ja_respondido = (
            db.query(Tentativa)
            .filter(
                Tentativa.aluno_id == aluno.id,
                Tentativa.simulado_id == simulado.id,
                Tentativa.status == StatusTentativa.ENVIADO,
            )
            .first()
            is not None
        )
        resultado.append(
            SimuladoResumo(
                id=simulado.id,
                titulo=simulado.titulo,
                disciplinas=simulado.disciplinas(),
                trimestre=simulado.trimestre,
                tempo_limite_min=simulado.tempo_limite_min,
                janela_inicio=simulado.janela_inicio,
                janela_fim=simulado.janela_fim,
                ja_respondido=ja_respondido,
            )
        )
    return resultado
