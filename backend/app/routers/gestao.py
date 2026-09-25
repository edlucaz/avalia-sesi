import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth_staff import apenas_gestao
from app.database import get_db
from app.models import Aluno, Funcionario, PraticaRegistro, StatusTentativa, Simulado, Tentativa, Turma
from app.schemas import (
    DesempenhoHabilidade,
    RankingPratica,
    SimuladoResumoGestao,
    TurmaResumoGestao,
    VisaoGeralEscola,
)

router = APIRouter(prefix="/api/gestao", tags=["gestao"])


def _ultima_tentativa_por_aluno(tentativas: list[Tentativa]) -> list[Tentativa]:
    ultima: dict[int, Tentativa] = {}
    for t in tentativas:
        atual = ultima.get(t.aluno_id)
        if not atual or t.id > atual.id:
            ultima[t.aluno_id] = t
    return list(ultima.values())


@router.get("/visao-geral", response_model=VisaoGeralEscola)
def visao_geral(
    _funcionario: Funcionario = Depends(apenas_gestao),
    db: Session = Depends(get_db),
):
    turmas_db = db.query(Turma).order_by(Turma.nome).all()
    simulados_db = db.query(Simulado).order_by(Simulado.janela_inicio).all()

    turmas_resumo = []
    for turma in turmas_db:
        simulados_da_turma = [s for s in simulados_db if turma in s.turmas_alvo]
        simulado_recente = max(simulados_da_turma, key=lambda s: s.janela_inicio, default=None)

        total_concluidos = 0
        nota_media = None
        if simulado_recente:
            tentativas = (
                db.query(Tentativa)
                .join(Tentativa.aluno)
                .filter(
                    Tentativa.simulado_id == simulado_recente.id,
                    Tentativa.aluno.has(turma_id=turma.id),
                )
                .all()
            )
            enviados = [
                t for t in _ultima_tentativa_por_aluno(tentativas) if t.status == StatusTentativa.ENVIADO
            ]
            total_concluidos = len(enviados)
            if enviados:
                nota_media = round(sum(t.nota_geral for t in enviados) / len(enviados), 1)

        turmas_resumo.append(
            TurmaResumoGestao(
                turma=turma.nome,
                etapa=turma.etapa,
                total_alunos=len(turma.alunos),
                total_concluidos=total_concluidos,
                nota_media=nota_media,
            )
        )

    simulados_resumo = []
    for s in simulados_db:
        alunos_elegiveis = {a.id for t in s.turmas_alvo for a in t.alunos}
        tentativas = db.query(Tentativa).filter(Tentativa.simulado_id == s.id).all()
        enviados = [
            t for t in _ultima_tentativa_por_aluno(tentativas) if t.status == StatusTentativa.ENVIADO
        ]
        nota_media = round(sum(t.nota_geral for t in enviados) / len(enviados), 1) if enviados else None
        simulados_resumo.append(
            SimuladoResumoGestao(
                id=s.id,
                titulo=s.titulo,
                turmas=[t.nome for t in s.turmas_alvo],
                nota_media=nota_media,
                total_concluidos=len(enviados),
                total_elegiveis=len(alunos_elegiveis),
                janela_inicio=s.janela_inicio,
            )
        )

    por_habilidade: dict[tuple[str, str], list[int]] = {}
    tentativas_enviadas = db.query(Tentativa).filter(Tentativa.status == StatusTentativa.ENVIADO).all()
    for t in tentativas_enviadas:
        for resposta in t.respostas:
            questao = resposta.questao
            if not questao:
                continue
            chave = (questao.habilidade, questao.disciplina.value)
            por_habilidade.setdefault(chave, [0, 0])
            por_habilidade[chave][0] += 1
            if resposta.acerto:
                por_habilidade[chave][1] += 1

    ranking_habilidades = [
        DesempenhoHabilidade(
            habilidade=hab,
            disciplina=disc,
            total=total,
            acertos=acertos,
            percentual=round((acertos / total) * 100, 1) if total else 0.0,
        )
        for (hab, disc), (total, acertos) in por_habilidade.items()
    ]
    ranking_habilidades.sort(key=lambda d: d.percentual)

    contagem_pratica: dict[int, list[int]] = {}
    for r in db.query(PraticaRegistro).all():
        contagem_pratica.setdefault(r.aluno_id, [0, 0])
        contagem_pratica[r.aluno_id][0] += 1
        if r.acerto:
            contagem_pratica[r.aluno_id][1] += 1

    ranking_pratica = []
    for aluno_id, (total, acertos) in contagem_pratica.items():
        aluno = db.query(Aluno).filter(Aluno.id == aluno_id).first()
        if not aluno:
            continue
        ranking_pratica.append(
            RankingPratica(
                aluno=aluno.nome,
                rm=aluno.rm,
                turma=aluno.turma.nome,
                total_respondidas=total,
                total_acertos=acertos,
            )
        )
    ranking_pratica.sort(key=lambda r: -r.total_respondidas)

    return VisaoGeralEscola(
        turmas=turmas_resumo,
        simulados=simulados_resumo,
        ranking_habilidades_fracas=ranking_habilidades[:10],
        ranking_pratica=ranking_pratica[:10],
    )


@router.get("/exportar.csv")
def exportar_csv(
    _funcionario: Funcionario = Depends(apenas_gestao),
    db: Session = Depends(get_db),
):
    buffer = io.StringIO()
    escritor = csv.writer(buffer)
    escritor.writerow(["turma", "aluno", "rm", "simulado", "status", "nota"])

    tentativas = db.query(Tentativa).order_by(Tentativa.simulado_id, Tentativa.aluno_id).all()
    for t in tentativas:
        escritor.writerow(
            [
                t.aluno.turma.nome,
                t.aluno.nome,
                t.aluno.rm,
                t.simulado.titulo,
                t.status.value,
                t.nota_geral if t.nota_geral is not None else "",
            ]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=avalia-sesi-resultados.csv"},
    )
