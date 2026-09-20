"""Popula o banco com dados de exemplo para testar a plataforma localmente.

Uso:
    python seed.py
"""

from datetime import datetime, timedelta

from app.database import Base, SessionLocal, engine
from app.models import (
    Aluno,
    Disciplina,
    MetaInstitucional,
    Questao,
    Simulado,
    SimuladoQuestao,
    Turma,
)

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

questoes_portugues = [
    Questao(
        disciplina=Disciplina.PORTUGUES,
        habilidade="EF05LP03",
        ano_origem=2023,
        enunciado="Leia a tirinha e identifique o efeito de humor produzido pela repetição da "
        "palavra 'não' no último quadrinho. Esse recurso é chamado de:",
        alternativas={
            "a": "Rima",
            "b": "Anáfora",
            "c": "Metáfora",
            "d": "Onomatopeia",
        },
        gabarito="b",
        dificuldade="media",
    ),
    Questao(
        disciplina=Disciplina.PORTUGUES,
        habilidade="EF05LP03",
        ano_origem=2022,
        enunciado="No trecho 'O menino correu rápido, mas não alcançou o ônibus', a palavra "
        "destacada em itálico ('mas') estabelece uma relação de:",
        alternativas={
            "a": "Adição",
            "b": "Causa",
            "c": "Oposição",
            "d": "Tempo",
        },
        gabarito="c",
        dificuldade="media",
    ),
    Questao(
        disciplina=Disciplina.PORTUGUES,
        habilidade="EF05LP18",
        ano_origem=2023,
        enunciado="Assinale a alternativa em que todas as palavras estão grafadas "
        "corretamente:",
        alternativas={
            "a": "Excessão, cresimento, nescessário",
            "b": "Exceção, crescimento, necessário",
            "c": "Esceção, crecimento, nesessário",
            "d": "Excesão, crescimento, necesário",
        },
        gabarito="b",
        dificuldade="facil",
    ),
    Questao(
        disciplina=Disciplina.PORTUGUES,
        habilidade="EF05LP22",
        ano_origem=2021,
        enunciado="Qual é a finalidade principal de um texto do gênero 'notícia'?",
        alternativas={
            "a": "Convencer o leitor a comprar um produto",
            "b": "Informar o leitor sobre um fato atual",
            "c": "Contar uma história de ficção",
            "d": "Ensinar o passo a passo de uma receita",
        },
        gabarito="b",
        dificuldade="facil",
    ),
    Questao(
        disciplina=Disciplina.PORTUGUES,
        habilidade="EF05LP01",
        ano_origem=2022,
        enunciado="No poema, o verso 'A lua é uma fruta de prata no céu escuro' é um exemplo de:",
        alternativas={
            "a": "Comparação",
            "b": "Metáfora",
            "c": "Aliteração",
            "d": "Hipérbole",
        },
        gabarito="b",
        dificuldade="dificil",
    ),
]

questoes_matematica = [
    Questao(
        disciplina=Disciplina.MATEMATICA,
        habilidade="EF05MA07",
        ano_origem=2023,
        enunciado="Uma pizza foi dividida em 8 pedaços iguais. Se Marcos comeu 3 pedaços, "
        "que fração da pizza ele comeu?",
        alternativas={"a": "3/5", "b": "3/8", "c": "5/8", "d": "8/3"},
        gabarito="b",
        dificuldade="facil",
    ),
    Questao(
        disciplina=Disciplina.MATEMATICA,
        habilidade="EF05MA13",
        ano_origem=2022,
        enunciado="Um terreno retangular tem 12 metros de comprimento e 7 metros de largura. "
        "Qual é a área desse terreno?",
        alternativas={"a": "19 m²", "b": "38 m²", "c": "84 m²", "d": "94 m²"},
        gabarito="c",
        dificuldade="media",
    ),
    Questao(
        disciplina=Disciplina.MATEMATICA,
        habilidade="EF05MA20",
        ano_origem=2023,
        enunciado="Em uma turma de 30 alunos, 40% preferem futebol. Quantos alunos preferem "
        "futebol?",
        alternativas={"a": "10", "b": "12", "c": "15", "d": "40"},
        gabarito="b",
        dificuldade="media",
    ),
    Questao(
        disciplina=Disciplina.MATEMATICA,
        habilidade="EF05MA06",
        ano_origem=2021,
        enunciado="Qual é o resultado de 4.500 ÷ 15?",
        alternativas={"a": "30", "b": "300", "c": "3.000", "d": "45"},
        gabarito="b",
        dificuldade="media",
    ),
    Questao(
        disciplina=Disciplina.MATEMATICA,
        habilidade="EF05MA19",
        ano_origem=2022,
        enunciado="Um gráfico de barras mostra as vendas de uma loja em 4 meses. Se janeiro "
        "teve 120 vendas e fevereiro teve o dobro de janeiro, quantas vendas fevereiro teve?",
        alternativas={"a": "60", "b": "120", "c": "180", "d": "240"},
        gabarito="d",
        dificuldade="facil",
    ),
]

todas_questoes = questoes_portugues + questoes_matematica
db.add_all(todas_questoes)
db.commit()

simulado = Simulado(
    titulo="Simulado Avalia SESI — 1º Trimestre",
    etapa=5,
    trimestre=1,
    tempo_limite_min=40,
    janela_inicio=datetime.utcnow() - timedelta(days=1),
    janela_fim=datetime.utcnow() + timedelta(days=30),
)
simulado.turmas_alvo = [turmas["5A"], turmas["5B"]]
db.add(simulado)
db.commit()

for ordem, questao in enumerate(todas_questoes, start=1):
    db.add(SimuladoQuestao(simulado_id=simulado.id, questao_id=questao.id, ordem=ordem))
db.commit()

db.add_all(
    [
        MetaInstitucional(etapa=5, disciplina=Disciplina.PORTUGUES, trimestre=1, valor_alvo_pct=70.0),
        MetaInstitucional(etapa=5, disciplina=Disciplina.MATEMATICA, trimestre=1, valor_alvo_pct=65.0),
    ]
)
db.commit()

print("Seed concluído:")
print(f"  {len(turmas)} turmas, {len(alunos)} alunos, {len(todas_questoes)} questões")
print(f"  Simulado #{simulado.id}: '{simulado.titulo}' (turmas 5A e 5B)")
print()
print("Login de teste: RM 50001, turma 5A")
print("Token do professor (painel): dev-professor (ou o valor de PROFESSOR_TOKEN no .env)")
