from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# --- Auth ---
class LoginRequest(BaseModel):
    rm: str
    turma: str


class LoginResponse(BaseModel):
    access_token: str
    aluno: "AlunoOut"


class AlunoOut(BaseModel):
    id: int
    rm: str
    nome: str
    turma: str

    class Config:
        from_attributes = True


# --- Simulados (listagem) ---
class SimuladoResumo(BaseModel):
    id: int
    titulo: str
    disciplinas: list[str]
    trimestre: int
    tempo_limite_min: int
    janela_inicio: datetime
    janela_fim: datetime
    ja_respondido: bool

    class Config:
        from_attributes = True


# --- Execução do simulado ---
class QuestaoProva(BaseModel):
    id: int
    ordem: int
    disciplina: str
    enunciado: str
    alternativas: dict[str, str]


class TentativaIniciada(BaseModel):
    tentativa_id: int
    tempo_limite_min: int
    tempo_restante_seg: int
    questoes: list[QuestaoProva]


class ResponderRequest(BaseModel):
    questao_id: int
    alternativa_marcada: Optional[str] = None
    marcada_para_revisao: bool = False


class EnviarTentativaResponse(BaseModel):
    tentativa_id: int
    nota_geral: float


# --- Resultado ---
class QuestaoComentada(BaseModel):
    questao_id: int
    disciplina: str
    habilidade: str
    enunciado: str
    alternativas: dict[str, str]
    gabarito: str
    alternativa_marcada: Optional[str]
    acerto: bool


class DesempenhoHabilidade(BaseModel):
    habilidade: str
    disciplina: str
    total: int
    acertos: int
    percentual: float


class ResultadoTentativa(BaseModel):
    tentativa_id: int
    simulado_titulo: str
    nota_geral: float
    total_questoes: int
    total_acertos: int
    desempenho_por_habilidade: list[DesempenhoHabilidade]
    questoes: list[QuestaoComentada]


# --- Painel do professor ---
class AlunoPainel(BaseModel):
    aluno: str
    rm: str
    status: str
    nota_geral: Optional[float]


class PainelSimulado(BaseModel):
    simulado_id: int
    titulo: str
    turma: str
    total_alunos: int
    total_concluidos: int
    nota_media: Optional[float]
    meta_institucional: Optional[float]
    ranking_habilidades_mais_erradas: list[DesempenhoHabilidade]
    alunos: list[AlunoPainel]
