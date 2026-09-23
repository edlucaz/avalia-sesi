"""Popula o banco com as turmas/alunos de exemplo e o banco de questões reais
do 5º ano (Avalia+ SESI-SP, 1ª Aplicação 2026 — Matemática e Português).

Uso:
    python seed.py
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

from app.database import Base, SessionLocal, engine
from app.models import (
    Aluno,
    Disciplina,
    MetaInstitucional,
    ModoSorteio,
    Questao,
    Simulado,
    TipoItem,
    Turma,
)

QUESTOES_5ANO_PATH = Path(__file__).parent / "seed_data" / "questoes_5ano_2026_1ap.json"

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if db.query(Turma).first():
    print("Banco já populado — nada a fazer. Apague avalia_sesi.db para recriar do zero.")
    raise SystemExit(0)

turmas = {
    nome: Turma(nome=nome, etapa=etapa)
    for nome, etapa in [
        ("3A", 3), ("3B", 3), ("4A", 4), ("4B", 4), ("5A", 5), ("5B", 5),
    ]
}
db.add_all(turmas.values())
db.commit()

alunos = [
    Aluno(rm="50001", nome="Ana Beatriz Souza", turma_id=turmas["5A"].id),
    Aluno(rm="50002", nome="Bruno Carvalho Lima", turma_id=turmas["5A"].id),
    Aluno(rm="50003", nome="Carla Ferreira Dias", turma_id=turmas["5A"].id),
    Aluno(rm="50004", nome="Diego Martins Rocha", turma_id=turmas["5B"].id),
    Aluno(rm="50005", nome="Elisa Nunes Pereira", turma_id=turmas["5B"].id),
]
db.add_all(alunos)
db.commit()

dados_questoes = json.loads(QUESTOES_5ANO_PATH.read_text())
todas_questoes = [
    Questao(
        disciplina=Disciplina(q["disciplina"]),
        etapa=q["etapa"],
        habilidade=q["habilidade"],
        descritor=q["descritor"],
        tipo_item=TipoItem(q["tipo_item"]),
        ano_origem=q["ano_origem"],
        enunciado=q["enunciado"],
        alternativas=q["alternativas"],
        gabarito=q["gabarito"],
        imagem_url=q["imagem_url"].removeprefix("/questoes/"),
        comentario_pedagogico=q["comentario_pedagogico"],
        fonte=q["fonte"],
    )
    for q in dados_questoes
]
db.add_all(todas_questoes)
db.commit()

qtd_mt = sum(1 for q in dados_questoes if q["disciplina"] == "matematica")
qtd_lp = sum(1 for q in dados_questoes if q["disciplina"] == "portugues")

simulado = Simulado(
    titulo="Simulado Avalia+ — 5º ano (Matemática e Português)",
    etapa=5,
    trimestre=1,
    tempo_limite_min=30,
    janela_inicio=datetime.utcnow() - timedelta(days=1),
    janela_fim=datetime.utcnow() + timedelta(days=365),
    modo_sorteio=ModoSorteio.POR_ALUNO,
    qtd_matematica=5,
    qtd_portugues=5,
)
simulado.turmas_alvo = [turmas["5A"], turmas["5B"]]
db.add(simulado)
db.commit()

db.add_all(
    [
        MetaInstitucional(etapa=5, disciplina=Disciplina.PORTUGUES, trimestre=1, valor_alvo_pct=70.0),
        MetaInstitucional(etapa=5, disciplina=Disciplina.MATEMATICA, trimestre=1, valor_alvo_pct=65.0),
    ]
)
db.commit()

print("Seed concluído:")
print(f"  {len(turmas)} turmas, {len(alunos)} alunos")
print(f"  Banco de questões reais do 5º ano: {qtd_mt} de Matemática + {qtd_lp} de Português")
print(f"  Simulado #{simulado.id}: '{simulado.titulo}' — sorteia 5+5 por aluno a cada tentativa")
print()
print("Login de teste: RM 50001, turma 5A")
print("Token do professor (painel): dev-professor (ou o valor de PROFESSOR_TOKEN no .env)")
