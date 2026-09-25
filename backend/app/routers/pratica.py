import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import aluno_atual
from app.database import get_db
from app.gamificacao import calcular_pontos, calcular_selos, faixa_de
from app.models import Aluno, PraticaRegistro, Questao, Turma
from app.schemas import (
    MeuProgressoTreino,
    QuestaoTreino,
    RankingTreino,
    RankingTreinoItem,
    ResponderTreinoRequest,
    ResultadoTreino,
)

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


def _agregados_aluno(db: Session, aluno_id: int):
    registros = (
        db.query(PraticaRegistro)
        .filter(PraticaRegistro.aluno_id == aluno_id)
        .order_by(PraticaRegistro.criado_em)
        .all()
    )
    pontos_totais = sum(r.pontos for r in registros)
    total_acertos = sum(1 for r in registros if r.acerto)
    melhor_sequencia = max((r.sequencia_no_momento for r in registros), default=0)
    dias = [r.criado_em.date() for r in registros]
    return registros, pontos_totais, total_acertos, melhor_sequencia, dias


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

    ultimo = (
        db.query(PraticaRegistro)
        .filter(PraticaRegistro.aluno_id == aluno.id)
        .order_by(PraticaRegistro.criado_em.desc())
        .first()
    )
    selos_antes = set()
    if ultimo:
        registros_antes, _, total_acertos_antes, melhor_seq_antes, dias_antes = _agregados_aluno(
            db, aluno.id
        )
        selos_antes = set(
            calcular_selos(len(registros_antes), total_acertos_antes, melhor_seq_antes, dias_antes)
        )

    sequencia = (ultimo.sequencia_no_momento + 1) if (ultimo and ultimo.acerto and acerto) else (1 if acerto else 0)
    pontos_ganhos = calcular_pontos(acerto, sequencia)

    registro = PraticaRegistro(
        aluno_id=aluno.id,
        questao_id=questao.id,
        alternativa_marcada=payload.alternativa_marcada,
        acerto=acerto,
        pontos=pontos_ganhos,
        sequencia_no_momento=sequencia,
        criado_em=datetime.utcnow(),
    )
    db.add(registro)
    db.commit()

    registros, pontos_totais, total_acertos, melhor_sequencia, dias = _agregados_aluno(db, aluno.id)
    faixa_atual, _, _ = faixa_de(pontos_totais)
    selos_depois = set(calcular_selos(len(registros), total_acertos, melhor_sequencia, dias))
    novos_selos = sorted(selos_depois - selos_antes)

    return ResultadoTreino(
        questao_id=questao.id,
        gabarito=questao.gabarito,
        alternativa_marcada=payload.alternativa_marcada,
        acerto=acerto,
        descritor=questao.descritor,
        comentario_pedagogico=questao.comentario_pedagogico,
        pontos_ganhos=pontos_ganhos,
        sequencia_atual=sequencia,
        pontos_totais=pontos_totais,
        faixa_atual=faixa_atual,
        novos_selos=novos_selos,
    )


@router.get("/meu-progresso", response_model=MeuProgressoTreino)
def meu_progresso(aluno: Aluno = Depends(aluno_atual), db: Session = Depends(get_db)):
    registros, pontos_totais, total_acertos, melhor_sequencia, dias = _agregados_aluno(db, aluno.id)
    faixa_atual, proxima_faixa, pontos_para_proxima = faixa_de(pontos_totais)
    sequencia_atual = registros[-1].sequencia_no_momento if registros and registros[-1].acerto else 0
    selos = calcular_selos(len(registros), total_acertos, melhor_sequencia, dias)

    return MeuProgressoTreino(
        pontos_totais=pontos_totais,
        faixa_atual=faixa_atual,
        proxima_faixa=proxima_faixa,
        pontos_para_proxima=pontos_para_proxima,
        sequencia_atual=sequencia_atual,
        melhor_sequencia=melhor_sequencia,
        total_respondidas=len(registros),
        total_acertos=total_acertos,
        selos=selos,
    )


def _ranking_de(db: Session, alunos: list[Aluno]) -> list[RankingTreinoItem]:
    itens = []
    for aluno in alunos:
        pontos = (
            db.query(PraticaRegistro)
            .filter(PraticaRegistro.aluno_id == aluno.id)
            .with_entities(PraticaRegistro.pontos)
            .all()
        )
        total = sum(p[0] for p in pontos)
        faixa, _, _ = faixa_de(total)
        itens.append(
            RankingTreinoItem(posicao=0, aluno=aluno.nome, turma=aluno.turma.nome, pontos=total, faixa=faixa)
        )
    itens.sort(key=lambda i: -i.pontos)
    for i, item in enumerate(itens, start=1):
        item.posicao = i
    return itens


@router.get("/ranking", response_model=RankingTreino)
def ranking(aluno: Aluno = Depends(aluno_atual), db: Session = Depends(get_db)):
    alunos_turma = db.query(Aluno).filter(Aluno.turma_id == aluno.turma_id).all()
    alunos_escola = (
        db.query(Aluno)
        .join(Aluno.turma)
        .filter(Turma.etapa == aluno.turma.etapa)
        .all()
    )

    ranking_turma = _ranking_de(db, alunos_turma)
    ranking_escola = _ranking_de(db, alunos_escola)

    posicao_turma = next((i.posicao for i in ranking_turma if i.aluno == aluno.nome), None)
    posicao_escola = next((i.posicao for i in ranking_escola if i.aluno == aluno.nome), None)

    return RankingTreino(
        ranking_turma=ranking_turma[:10],
        posicao_turma=posicao_turma,
        ranking_escola=ranking_escola[:10],
        posicao_escola=posicao_escola,
    )
