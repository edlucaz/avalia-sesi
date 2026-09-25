"""Liberação de simulado por turma (colunas extras da tabela simulado_turma)."""

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import simulado_turma


def vinculo_turma(db: Session, simulado_id: int, turma_id: int):
    """Linha (liberado, mostrar_resultado) do simulado para a turma, ou None se a
    turma não participa do simulado."""
    return db.execute(
        select(simulado_turma.c.liberado, simulado_turma.c.mostrar_resultado).where(
            simulado_turma.c.simulado_id == simulado_id,
            simulado_turma.c.turma_id == turma_id,
        )
    ).first()


def vinculos_do_simulado(db: Session, simulado_id: int) -> dict[int, tuple[bool, bool]]:
    linhas = db.execute(
        select(
            simulado_turma.c.turma_id,
            simulado_turma.c.liberado,
            simulado_turma.c.mostrar_resultado,
        ).where(simulado_turma.c.simulado_id == simulado_id)
    ).all()
    return {turma_id: (liberado, mostrar) for turma_id, liberado, mostrar in linhas}


def atualizar_vinculo(db: Session, simulado_id: int, turma_ids: list[int], **valores):
    db.execute(
        update(simulado_turma)
        .where(
            simulado_turma.c.simulado_id == simulado_id,
            simulado_turma.c.turma_id.in_(turma_ids),
        )
        .values(**valores)
    )
