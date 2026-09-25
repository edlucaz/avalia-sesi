from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import aluno_atual
from app.database import get_db
from app.liberacao import vinculo_turma
from app.models import Aluno, Simulado, StatusTentativa, Tentativa, simulado_turma
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
        .join(simulado_turma, simulado_turma.c.simulado_id == Simulado.id)
        .filter(simulado_turma.c.turma_id == aluno.turma_id, simulado_turma.c.liberado.is_(True))
        .filter(Simulado.janela_inicio <= agora, Simulado.janela_fim >= agora)
        .all()
    )

    resultado = []
    for simulado in simulados:
        mostrar_resultado = vinculo_turma(db, simulado.id, aluno.turma_id).mostrar_resultado
        ultima_tentativa = (
            db.query(Tentativa)
            .filter(
                Tentativa.aluno_id == aluno.id,
                Tentativa.simulado_id == simulado.id,
                Tentativa.status == StatusTentativa.ENVIADO,
            )
            .order_by(Tentativa.id.desc())
            .first()
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
                ultima_tentativa_id=ultima_tentativa.id if ultima_tentativa else None,
                ultima_nota=(
                    ultima_tentativa.nota_geral if ultima_tentativa and mostrar_resultado else None
                ),
                resultado_disponivel=mostrar_resultado,
            )
        )
    return resultado
