"""Popula o banco com as turmas/alunos de exemplo e o banco de questões reais
do 5º ano (Avalia+ SESI-SP, 1ª Aplicação 2026 — Matemática e Português).

Uso:
    python seed.py
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

from app.auth_staff import SENHA_PADRAO, hash_senha
from app.database import Base, SessionLocal, engine
from app.models import (
    Aluno,
    Disciplina,
    Funcionario,
    MetaInstitucional,
    ModoSorteio,
    Papel,
    Questao,
    Simulado,
    StatusFuncionario,
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

senha_padrao_hash = hash_senha(SENHA_PADRAO)
funcionarios = [
    Funcionario(
        nome="Lucas Rocha",
        email="lucas.erocha@sesisp.org.br",
        papel=Papel.PROFESSOR,
        senha_hash=senha_padrao_hash,
        precisa_trocar_senha=True,
        status=StatusFuncionario.ATIVO,
    ),
    Funcionario(
        nome="Paola Lima",
        email="paola.lima@sesisp.org.br",
        papel=Papel.PROFESSOR,
        senha_hash=senha_padrao_hash,
        precisa_trocar_senha=True,
        status=StatusFuncionario.ATIVO,
    ),
    Funcionario(
        nome="Thaize Simionatto",
        email="thaize.simionatto@sesisp.org.br",
        papel=Papel.PROFESSOR,
        senha_hash=senha_padrao_hash,
        precisa_trocar_senha=True,
        status=StatusFuncionario.ATIVO,
    ),
    Funcionario(
        nome="Adriana Barai",
        email="adriana.barai@sesisp.org",
        papel=Papel.DIRECAO,
        senha_hash=senha_padrao_hash,
        precisa_trocar_senha=True,
        status=StatusFuncionario.ATIVO,
    ),
    Funcionario(
        nome="Anna Leticia",
        email="anna.leticia@sesisp.org.br",
        papel=Papel.COORDENACAO,
        senha_hash=senha_padrao_hash,
        precisa_trocar_senha=True,
        status=StatusFuncionario.ATIVO,
    ),
]
db.add_all(funcionarios)
db.commit()

dados_questoes = json.loads(QUESTOES_5ANO_PATH.read_text())

# Extração de PDF às vezes cola duas alternativas numa só e deixa a seguinte vazia.
for q in dados_questoes:
    vazias = [letra for letra, texto in q["alternativas"].items() if not texto.strip()]
    if vazias or q["gabarito"] not in q["alternativas"]:
        raise SystemExit(
            f"Questão inválida ({q['imagem_url']}): alternativas vazias {vazias}, "
            f"gabarito '{q['gabarito']}'. Confira o texto contra a imagem da prova."
        )

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
    modo_sorteio=ModoSorteio.TURMA_FIXA,
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
print(f"  {len(funcionarios)} funcionários (professores/gestão) — senha padrão: {SENHA_PADRAO}")
print(f"  Banco de questões reais do 5º ano: {qtd_mt} de Matemática + {qtd_lp} de Português")
print(f"  Simulado #{simulado.id}: '{simulado.titulo}' — mesmo sorteio (turma_fixa) pra 5A e 5B")
print()
print("Login de aluno de teste: RM 50001, turma 5A")
print("Login de professor/gestão: um dos e-mails cadastrados + senha padrão (troca no primeiro acesso)")
