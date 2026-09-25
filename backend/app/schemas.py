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
    ultima_tentativa_id: Optional[int] = None
    ultima_nota: Optional[float] = None

    class Config:
        from_attributes = True


# --- Execução do simulado ---
class QuestaoProva(BaseModel):
    id: int
    ordem: int
    disciplina: str
    enunciado: str
    alternativas: dict[str, str]
    tem_imagem: bool = False


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
    descritor: Optional[str] = None
    enunciado: str
    alternativas: dict[str, str]
    gabarito: str
    alternativa_marcada: Optional[str]
    acerto: bool
    tem_imagem: bool = False
    comentario_pedagogico: Optional[str] = None


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


# --- Modo treino (prática avulsa) ---
class QuestaoTreino(BaseModel):
    questao_id: int
    disciplina: str
    enunciado: str
    alternativas: dict[str, str]
    tem_imagem: bool = False


class ResponderTreinoRequest(BaseModel):
    questao_id: int
    alternativa_marcada: str


class ResultadoTreino(BaseModel):
    questao_id: int
    gabarito: str
    alternativa_marcada: str
    acerto: bool
    descritor: Optional[str] = None
    comentario_pedagogico: Optional[str] = None
    pontos_ganhos: int = 0
    sequencia_atual: int = 0
    pontos_totais: int = 0
    faixa_atual: str = "Bronze"
    novos_selos: list[str] = []


class MeuProgressoTreino(BaseModel):
    pontos_totais: int
    faixa_atual: str
    proxima_faixa: Optional[str]
    pontos_para_proxima: Optional[int]
    sequencia_atual: int
    melhor_sequencia: int
    total_respondidas: int
    total_acertos: int
    selos: list[str]


class RankingTreinoItem(BaseModel):
    posicao: int
    aluno: str
    turma: str
    pontos: int
    faixa: str


class RankingTreino(BaseModel):
    ranking_turma: list[RankingTreinoItem]
    posicao_turma: Optional[int]
    ranking_escola: list[RankingTreinoItem]
    posicao_escola: Optional[int]


# --- Acesso de professores/gestores (funcionários) ---
class FuncionarioOut(BaseModel):
    id: int
    nome: str
    email: str
    papel: str

    class Config:
        from_attributes = True


class StaffLoginRequest(BaseModel):
    email: str
    senha: str


class StaffLoginResponse(BaseModel):
    access_token: str
    precisa_trocar_senha: bool
    funcionario: FuncionarioOut


class TrocarSenhaRequest(BaseModel):
    senha_nova: str


class SolicitarAcessoRequest(BaseModel):
    nome: str
    email: str


class CadastrarFuncionarioRequest(BaseModel):
    nome: str
    email: str
    papel: str  # "professor" | "coordenacao" | "direcao"
    turmas: Optional[list[str]] = None


class SolicitacaoOut(BaseModel):
    id: int
    nome: str
    email: str
    status: str
    criado_em: datetime

    class Config:
        from_attributes = True


# --- Painel consolidado da escola (coordenação/direção) ---
class TurmaResumoGestao(BaseModel):
    turma: str
    etapa: int
    total_alunos: int
    total_concluidos: int
    nota_media: Optional[float]


class SimuladoResumoGestao(BaseModel):
    id: int
    titulo: str
    turmas: list[str]
    nota_media: Optional[float]
    total_concluidos: int
    total_elegiveis: int
    janela_inicio: datetime


class RankingPratica(BaseModel):
    aluno: str
    rm: str
    turma: str
    total_respondidas: int
    total_acertos: int


class VisaoGeralEscola(BaseModel):
    turmas: list[TurmaResumoGestao]
    simulados: list[SimuladoResumoGestao]
    ranking_habilidades_fracas: list[DesempenhoHabilidade]
    ranking_pratica: list[RankingPratica]


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


class TurmaOut(BaseModel):
    nome: str
    etapa: int

    class Config:
        from_attributes = True


class SimuladoCriarRequest(BaseModel):
    titulo: str
    etapa: int
    trimestre: int = 1
    tempo_limite_min: int = 30
    dias_disponivel: int = 30
    turmas: list[str]
    qtd_matematica: int = 5
    qtd_portugues: int = 5
    modo_sorteio: str = "turma_fixa"  # "por_aluno" | "turma_fixa"


class SimuladoCriado(BaseModel):
    id: int
    titulo: str
    turmas: list[str]
    janela_inicio: datetime
    janela_fim: datetime
    modo_sorteio: str
    qtd_matematica: Optional[int]
    qtd_portugues: Optional[int]
