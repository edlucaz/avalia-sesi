import os

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Questao, Resposta, Simulado, StatusTentativa, Tentativa, Turma
from app.schemas import AlunoPainel, DesempenhoHabilidade, PainelSimulado

router = APIRouter(prefix="/api/professor", tags=["professor"])

PROFESSOR_TOKEN = os.getenv("PROFESSOR_TOKEN", "dev-professor")


def professor_autorizado(x_professor_token: str | None = Header(default=None)):
    if x_professor_token != PROFESSOR_TOKEN:
        raise HTTPException(status_code=401, detail="Acesso de professor não autorizado")


@router.get(
    "/simulados/{simulado_id}/painel",
    response_model=PainelSimulado,
    dependencies=[Depends(professor_autorizado)],
)
def painel_simulado(simulado_id: int, turma: str, db: Session = Depends(get_db)):
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
