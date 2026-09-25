from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_staff import funcionario_atual
from app.database import get_db
from app.models import Funcionario, ModoSorteio, Questao, Resposta, Simulado, StatusTentativa, Tentativa, Turma
from app.schemas import (
    AlunoPainel,
    DesempenhoHabilidade,
    PainelSimulado,
    SimuladoCriarRequest,
    SimuladoCriado,
    TurmaOut,
)

router = APIRouter(prefix="/api/professor", tags=["professor"])


def turmas_visiveis(funcionario: Funcionario, db: Session) -> list[Turma]:
    if funcionario.pode_ver_tudo() or not funcionario.turmas:
        return db.query(Turma).order_by(Turma.nome).all()
    return sorted(funcionario.turmas, key=lambda t: t.nome)


@router.get("/turmas", response_model=list[TurmaOut])
def listar_turmas(
    funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    return turmas_visiveis(funcionario, db)


def _simulado_out(s: Simulado) -> SimuladoCriado:
    return SimuladoCriado(
        id=s.id,
        titulo=s.titulo,
        turmas=[t.nome for t in s.turmas_alvo],
        janela_inicio=s.janela_inicio,
        janela_fim=s.janela_fim,
        modo_sorteio=s.modo_sorteio.value,
        qtd_matematica=s.qtd_matematica,
        qtd_portugues=s.qtd_portugues,
        tempo_limite_min=s.tempo_limite_min,
        liberado=s.liberado,
    )


@router.get("/simulados", response_model=list[SimuladoCriado])
def listar_simulados(
    funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    simulados = db.query(Simulado).order_by(Simulado.janela_inicio, Simulado.id).all()
    return [_simulado_out(s) for s in simulados]


@router.post("/simulados/{simulado_id}/liberar", response_model=SimuladoCriado)
def liberar_simulado(
    simulado_id: int,
    funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    simulado = db.query(Simulado).filter(Simulado.id == simulado_id).first()
    if not simulado:
        raise HTTPException(status_code=404, detail="Simulado não encontrado")
    if not set(simulado.turmas_alvo) & set(turmas_visiveis(funcionario, db)):
        raise HTTPException(status_code=403, detail="Você não tem acesso às turmas deste simulado")
    simulado.liberado = True
    db.commit()
    return _simulado_out(simulado)


@router.post("/simulados", response_model=SimuladoCriado)
def criar_simulado(
    payload: SimuladoCriarRequest,
    _funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    turmas = db.query(Turma).filter(Turma.nome.in_([t.upper() for t in payload.turmas])).all()
    if not turmas:
        raise HTTPException(status_code=400, detail="Nenhuma turma válida informada")

    try:
        modo = ModoSorteio(payload.modo_sorteio)
    except ValueError:
        raise HTTPException(status_code=400, detail="modo_sorteio inválido")

    agora = datetime.utcnow()
    simulado = Simulado(
        titulo=payload.titulo,
        etapa=payload.etapa,
        trimestre=payload.trimestre,
        tempo_limite_min=payload.tempo_limite_min,
        janela_inicio=agora,
        janela_fim=agora + timedelta(days=payload.dias_disponivel),
        modo_sorteio=modo,
        qtd_matematica=payload.qtd_matematica,
        qtd_portugues=payload.qtd_portugues,
    )
    simulado.turmas_alvo = turmas
    db.add(simulado)
    db.commit()
    db.refresh(simulado)
    return _simulado_out(simulado)


@router.get("/simulados/{simulado_id}/painel", response_model=PainelSimulado)
def painel_simulado(
    simulado_id: int,
    turma: str,
    _funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    simulado = db.query(Simulado).filter(Simulado.id == simulado_id).first()
    if not simulado:
        raise HTTPException(status_code=404, detail="Simulado não encontrado")

    turma_obj = db.query(Turma).filter(Turma.nome == turma.upper()).first()
    if not turma_obj or turma_obj not in simulado.turmas_alvo:
        raise HTTPException(status_code=404, detail="Turma não participa deste simulado")

    tentativas_todas = (
        db.query(Tentativa)
        .join(Tentativa.aluno)
        .filter(Tentativa.simulado_id == simulado_id, Tentativa.aluno.has(turma_id=turma_obj.id))
        .order_by(Tentativa.id.desc())
        .all()
    )
    # Com refazer liberado, um aluno pode ter várias tentativas: considera só a
    # mais recente de cada um para não contar/duplicar estatísticas.
    ultima_por_aluno: dict[int, Tentativa] = {}
    for t in tentativas_todas:
        ultima_por_aluno.setdefault(t.aluno_id, t)
    tentativas = list(ultima_por_aluno.values())
    concluidas = [t for t in tentativas if t.status == StatusTentativa.ENVIADO]

    alunos_painel = [
        AlunoPainel(
            aluno=t.aluno.nome,
            rm=t.aluno.rm,
            status="enviado" if t.status == StatusTentativa.ENVIADO else "em andamento",
            nota_geral=t.nota_geral,
        )
        for t in tentativas
    ]
    total_alunos_turma = len(turma_obj.alunos)
    ja_iniciaram_rms = {t.aluno.rm for t in tentativas}
    for aluno in turma_obj.alunos:
        if aluno.rm not in ja_iniciaram_rms:
            alunos_painel.append(
                AlunoPainel(aluno=aluno.nome, rm=aluno.rm, status="não fez", nota_geral=None)
            )

    nota_media = (
        round(sum(t.nota_geral for t in concluidas) / len(concluidas), 1) if concluidas else None
    )

    meta = None
    disciplinas = simulado.disciplinas()
    if disciplinas:
        from app.models import Disciplina, MetaInstitucional

        meta_obj = (
            db.query(MetaInstitucional)
            .filter(
                MetaInstitucional.etapa == simulado.etapa,
                MetaInstitucional.trimestre == simulado.trimestre,
                MetaInstitucional.disciplina == Disciplina(disciplinas[0]),
            )
            .first()
        )
        meta = meta_obj.valor_alvo_pct if meta_obj else None

    por_habilidade: dict[tuple[str, str], list[int]] = {}
    for t in concluidas:
        for resposta in t.respostas:
            questao = db.query(Questao).filter(Questao.id == resposta.questao_id).first()
            if not questao:
                continue
            chave = (questao.habilidade, questao.disciplina.value)
            por_habilidade.setdefault(chave, [0, 0])
            por_habilidade[chave][0] += 1
            if resposta.acerto:
                por_habilidade[chave][1] += 1

    ranking = [
        DesempenhoHabilidade(
            habilidade=hab,
            disciplina=disc,
            total=total,
            acertos=acertos,
            percentual=round((acertos / total) * 100, 1) if total else 0.0,
        )
        for (hab, disc), (total, acertos) in por_habilidade.items()
    ]
    ranking.sort(key=lambda d: d.percentual)

    return PainelSimulado(
        simulado_id=simulado.id,
        titulo=simulado.titulo,
        turma=turma_obj.nome,
        total_alunos=total_alunos_turma,
        total_concluidos=len(concluidas),
        nota_media=nota_media,
        meta_institucional=meta,
        ranking_habilidades_mais_erradas=ranking[:5],
        alunos=alunos_painel,
    )
