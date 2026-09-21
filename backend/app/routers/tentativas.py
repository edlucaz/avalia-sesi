from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import aluno_atual
from app.database import get_db
from app.models import (
    Aluno,
    Resposta,
    Simulado,
    StatusTentativa,
    Tentativa,
)
from app.schemas import (
    DesempenhoHabilidade,
    EnviarTentativaResponse,
    QuestaoComentada,
    QuestaoProva,
    ResponderRequest,
    ResultadoTentativa,
    TentativaIniciada,
)

router = APIRouter(tags=["tentativas"])


def _tentativa_do_aluno(tentativa_id: int, aluno: Aluno, db: Session) -> Tentativa:
    tentativa = db.query(Tentativa).filter(Tentativa.id == tentativa_id).first()
    if not tentativa or tentativa.aluno_id != aluno.id:
        raise HTTPException(status_code=404, detail="Tentativa não encontrada")
    return tentativa


def _corrigir(tentativa: Tentativa, db: Session) -> float:
    respostas = {r.questao_id: r for r in tentativa.respostas}
    total = len(tentativa.simulado.questoes)
    acertos = 0
    for sq in tentativa.simulado.questoes:
        resposta = respostas.get(sq.questao_id)
        acerto = bool(resposta and resposta.alternativa_marcada == sq.questao.gabarito)
        if resposta:
            resposta.acerto = acerto
        if acerto:
            acertos += 1
    nota = round((acertos / total) * 100, 1) if total else 0.0
    tentativa.status = StatusTentativa.ENVIADO
    tentativa.fim = datetime.utcnow()
    tentativa.nota_geral = nota
    db.commit()
    return nota


def _tempo_restante_seg(tentativa: Tentativa) -> int:
    limite_seg = tentativa.simulado.tempo_limite_min * 60
    decorrido = (datetime.utcnow() - tentativa.inicio).total_seconds()
    return max(0, int(limite_seg - decorrido))


def _expirar_se_necessario(tentativa: Tentativa, db: Session):
    if tentativa.status == StatusTentativa.EM_ANDAMENTO and _tempo_restante_seg(tentativa) <= 0:
        _corrigir(tentativa, db)


@router.post("/api/simulados/{simulado_id}/iniciar", response_model=TentativaIniciada)
def iniciar_simulado(
    simulado_id: int,
    aluno: Aluno = Depends(aluno_atual),
    db: Session = Depends(get_db),
):
    simulado = db.query(Simulado).filter(Simulado.id == simulado_id).first()
    if not simulado:
        raise HTTPException(status_code=404, detail="Simulado não encontrado")

    agora = datetime.utcnow()
    if not (simulado.janela_inicio <= agora <= simulado.janela_fim):
        raise HTTPException(status_code=403, detail="Simulado fora da janela de aplicação")

    tentativa = (
        db.query(Tentativa)
        .filter(Tentativa.aluno_id == aluno.id, Tentativa.simulado_id == simulado_id)
        .order_by(Tentativa.id.desc())
        .first()
    )
    # Por enquanto, permite refazer o simulado: se a tentativa mais recente já
    # foi enviada, começa uma tentativa nova em vez de bloquear.
    if not tentativa or tentativa.status == StatusTentativa.ENVIADO:
        tentativa = Tentativa(aluno_id=aluno.id, simulado_id=simulado_id)
        db.add(tentativa)
        db.commit()
        db.refresh(tentativa)

    _expirar_se_necessario(tentativa, db)
    if tentativa.status == StatusTentativa.ENVIADO:
        raise HTTPException(status_code=409, detail="Tempo esgotado, simulado já foi enviado")

    questoes = [
        QuestaoProva(
            id=sq.questao.id,
            ordem=sq.ordem,
            disciplina=sq.questao.disciplina.value,
            enunciado=sq.questao.enunciado,
            alternativas=sq.questao.alternativas,
        )
        for sq in tentativa.simulado.questoes
    ]

    return TentativaIniciada(
        tentativa_id=tentativa.id,
        tempo_limite_min=simulado.tempo_limite_min,
        tempo_restante_seg=_tempo_restante_seg(tentativa),
        questoes=questoes,
    )


@router.post("/api/tentativas/{tentativa_id}/responder")
def responder(
    tentativa_id: int,
    payload: ResponderRequest,
    aluno: Aluno = Depends(aluno_atual),
    db: Session = Depends(get_db),
):
    tentativa = _tentativa_do_aluno(tentativa_id, aluno, db)
    _expirar_se_necessario(tentativa, db)
    if tentativa.status != StatusTentativa.EM_ANDAMENTO:
        raise HTTPException(status_code=409, detail="Tentativa já foi enviada")

    resposta = (
        db.query(Resposta)
        .filter(Resposta.tentativa_id == tentativa_id, Resposta.questao_id == payload.questao_id)
        .first()
    )
    if not resposta:
        resposta = Resposta(tentativa_id=tentativa_id, questao_id=payload.questao_id)
        db.add(resposta)

    resposta.alternativa_marcada = payload.alternativa_marcada
    resposta.marcada_para_revisao = payload.marcada_para_revisao
    db.commit()
    return {"tempo_restante_seg": _tempo_restante_seg(tentativa)}


@router.post("/api/tentativas/{tentativa_id}/enviar", response_model=EnviarTentativaResponse)
def enviar(
    tentativa_id: int,
    aluno: Aluno = Depends(aluno_atual),
    db: Session = Depends(get_db),
):
    tentativa = _tentativa_do_aluno(tentativa_id, aluno, db)
    if tentativa.status == StatusTentativa.EM_ANDAMENTO:
        nota = _corrigir(tentativa, db)
    else:
        nota = tentativa.nota_geral or 0.0
    return EnviarTentativaResponse(tentativa_id=tentativa.id, nota_geral=nota)


@router.get("/api/tentativas/{tentativa_id}/resultado", response_model=ResultadoTentativa)
def resultado(
    tentativa_id: int,
    aluno: Aluno = Depends(aluno_atual),
    db: Session = Depends(get_db),
):
    tentativa = _tentativa_do_aluno(tentativa_id, aluno, db)
    if tentativa.status != StatusTentativa.ENVIADO:
        raise HTTPException(status_code=409, detail="Tentativa ainda não foi enviada")

    respostas = {r.questao_id: r for r in tentativa.respostas}
    questoes: list[QuestaoComentada] = []
    por_habilidade: dict[tuple[str, str], list[int]] = {}

    for sq in tentativa.simulado.questoes:
        questao = sq.questao
        resposta = respostas.get(questao.id)
        acerto = bool(resposta and resposta.acerto)
        questoes.append(
            QuestaoComentada(
                questao_id=questao.id,
                disciplina=questao.disciplina.value,
                habilidade=questao.habilidade,
                enunciado=questao.enunciado,
                alternativas=questao.alternativas,
                gabarito=questao.gabarito,
                alternativa_marcada=resposta.alternativa_marcada if resposta else None,
                acerto=acerto,
            )
        )
        chave = (questao.habilidade, questao.disciplina.value)
        por_habilidade.setdefault(chave, [0, 0])
        por_habilidade[chave][0] += 1
        if acerto:
            por_habilidade[chave][1] += 1

    desempenho = [
        DesempenhoHabilidade(
            habilidade=hab,
            disciplina=disc,
            total=total,
            acertos=acertos,
            percentual=round((acertos / total) * 100, 1) if total else 0.0,
        )
        for (hab, disc), (total, acertos) in sorted(por_habilidade.items())
    ]

    return ResultadoTentativa(
        tentativa_id=tentativa.id,
        simulado_titulo=tentativa.simulado.titulo,
        nota_geral=tentativa.nota_geral or 0.0,
        total_questoes=len(questoes),
        total_acertos=sum(1 for q in questoes if q.acerto),
        desempenho_por_habilidade=desempenho,
        questoes=questoes,
    )
