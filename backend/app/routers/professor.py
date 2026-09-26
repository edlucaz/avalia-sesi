from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_staff import funcionario_atual
from app.database import get_db
from app.liberacao import atualizar_vinculo, vinculos_do_simulado
from app.routers.tentativas import _garantir_questoes_turma_fixa
from app.models import Funcionario, ModoSorteio, Questao, Resposta, Simulado, StatusTentativa, Tentativa, Turma
from app.schemas import (
    AlterarResultadoRequest,
    AlunoPainel,
    DesempenhoHabilidade,
    LiberarSimuladoRequest,
    PainelSimulado,
    SimuladoCriarRequest,
    SimuladoCriado,
    TurmaLiberacao,
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


def _simulado_out(s: Simulado, db: Session) -> SimuladoCriado:
    vinculos = vinculos_do_simulado(db, s.id)
    turmas = sorted(s.turmas_alvo, key=lambda t: t.nome)
    donos_sorteio = {sq.turma_id for sq in s.questoes}

    def prova(turma_id: int) -> Optional[str]:
        if turma_id in donos_sorteio:
            return "propria"
        return "compartilhada" if None in donos_sorteio else None

    return SimuladoCriado(
        id=s.id,
        titulo=s.titulo,
        turmas=[t.nome for t in turmas],
        janela_inicio=s.janela_inicio,
        janela_fim=s.janela_fim,
        modo_sorteio=s.modo_sorteio.value,
        qtd_matematica=s.qtd_matematica,
        qtd_portugues=s.qtd_portugues,
        tempo_limite_min=s.tempo_limite_min,
        turmas_liberacao=[
            TurmaLiberacao(
                turma=t.nome,
                liberado=vinculos[t.id][0],
                mostrar_resultado=vinculos[t.id][1],
                prova=prova(t.id),
            )
            for t in turmas
        ],
    )


@router.get("/simulados", response_model=list[SimuladoCriado])
def listar_simulados(
    funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    simulados = db.query(Simulado).order_by(Simulado.janela_inicio, Simulado.id).all()
    return [_simulado_out(s, db) for s in simulados]


def _simulado_e_turma_do_professor(
    simulado_id: int, nome_turma: str, funcionario: Funcionario, db: Session
) -> tuple[Simulado, Turma]:
    simulado = db.query(Simulado).filter(Simulado.id == simulado_id).first()
    if not simulado:
        raise HTTPException(status_code=404, detail="Simulado não encontrado")
    turma = next((t for t in simulado.turmas_alvo if t.nome == nome_turma.upper()), None)
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não participa deste simulado")
    if turma not in turmas_visiveis(funcionario, db):
        raise HTTPException(status_code=403, detail="Você não tem acesso a esta turma")
    return simulado, turma


@router.post("/simulados/{simulado_id}/liberar", response_model=SimuladoCriado)
def liberar_simulado(
    simulado_id: int,
    payload: LiberarSimuladoRequest,
    funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    simulado, turma = _simulado_e_turma_do_professor(simulado_id, payload.turma, funcionario, db)
    if vinculos_do_simulado(db, simulado.id)[turma.id][0]:
        raise HTTPException(status_code=409, detail=f"Este simulado já foi liberado para o {turma.nome}")
    # Sorteia já na liberação: a turma inteira começa com o conjunto pronto.
    if not simulado.sorteia_por_aluno():
        _garantir_questoes_turma_fixa(simulado, db, turma.id, prova_propria=payload.nova_prova)
    atualizar_vinculo(
        db, simulado.id, [turma.id], liberado=True, mostrar_resultado=payload.mostrar_resultado
    )
    db.commit()
    return _simulado_out(simulado, db)


@router.post("/simulados/{simulado_id}/resultado", response_model=SimuladoCriado)
def alterar_resultado(
    simulado_id: int,
    payload: AlterarResultadoRequest,
    funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    """Mostra/esconde a nota e a correção para os alunos da turma — por exemplo,
    esconder durante a semana de aplicação e mostrar quando todos terminarem."""
    simulado, turma = _simulado_e_turma_do_professor(simulado_id, payload.turma, funcionario, db)
    atualizar_vinculo(db, simulado.id, [turma.id], mostrar_resultado=payload.mostrar_resultado)
    db.commit()
    return _simulado_out(simulado, db)


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
    atualizar_vinculo(
        db, simulado.id, [t.id for t in turmas], mostrar_resultado=payload.mostrar_resultado
    )
    db.commit()
    if modo == ModoSorteio.TURMA_FIXA and payload.prova_por_turma and len(turmas) > 1:
        for t in turmas:
            _garantir_questoes_turma_fixa(simulado, db, t.id, prova_propria=True)
    db.refresh(simulado)
    return _simulado_out(simulado, db)


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
