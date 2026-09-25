"""Regras do ranking gamificado do modo treino: pontuação, faixas e selos.

Fica separado num módulo próprio porque é usado tanto na hora de responder
(pratica.py, pra calcular e gravar os pontos de cada resposta) quanto nos
endpoints de ranking/progresso — mantém a mesma régua nos dois lugares.
"""

from datetime import date

PONTOS_BASE_ACERTO = 10
BONUS_POR_SEQUENCIA = 5  # por acerto consecutivo além do primeiro
BONUS_MAXIMO = 20  # trava em sequência 5 (4 * 5)

FAIXAS = [
    ("Bronze", 0),
    ("Prata", 300),
    ("Ouro", 800),
    ("Diamante", 1500),
]


def calcular_pontos(acerto: bool, sequencia_no_momento: int) -> int:
    """sequencia_no_momento já inclui a resposta atual (1 = primeiro acerto da sequência)."""
    if not acerto:
        return 0
    bonus = min((sequencia_no_momento - 1) * BONUS_POR_SEQUENCIA, BONUS_MAXIMO)
    return PONTOS_BASE_ACERTO + bonus


def faixa_de(pontos: int) -> tuple[str, str | None, int | None]:
    """Retorna (faixa_atual, proxima_faixa, pontos_para_proxima)."""
    atual = FAIXAS[0][0]
    for nome, minimo in FAIXAS:
        if pontos >= minimo:
            atual = nome
        else:
            return atual, nome, minimo - pontos
    return atual, None, None


def calcular_selos(
    total_respondidas: int,
    total_acertos: int,
    melhor_sequencia: int,
    dias_distintos: list[date],
) -> list[str]:
    selos = []
    if total_acertos >= 1:
        selos.append("Primeiro acerto")
    if total_respondidas >= 10:
        selos.append("10 questões respondidas")
    if total_respondidas >= 50:
        selos.append("50 questões respondidas")
    if total_respondidas >= 100:
        selos.append("100 questões respondidas")
    if melhor_sequencia >= 5:
        selos.append("Sequência de 5 acertos")
    if melhor_sequencia >= 10:
        selos.append("Sequência de 10 acertos")

    maior_run = _maior_sequencia_de_dias(dias_distintos)
    if maior_run >= 3:
        selos.append("3 dias seguidos praticando")
    if maior_run >= 7:
        selos.append("7 dias seguidos praticando")

    return selos


def _maior_sequencia_de_dias(dias: list[date]) -> int:
    dias_ordenados = sorted(set(dias))
    if not dias_ordenados:
        return 0
    maior = atual = 1
    for anterior, proximo in zip(dias_ordenados, dias_ordenados[1:]):
        if (proximo - anterior).days == 1:
            atual += 1
            maior = max(maior, atual)
        else:
            atual = 1
    return maior
