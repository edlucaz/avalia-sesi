import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Table,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Disciplina(str, enum.Enum):
    PORTUGUES = "portugues"
    MATEMATICA = "matematica"


class StatusTentativa(str, enum.Enum):
    EM_ANDAMENTO = "em_andamento"
    ENVIADO = "enviado"


class TipoItem(str, enum.Enum):
    ETAPA = "etapa"
    CONEXAO = "conexao"


class ModoSorteio(str, enum.Enum):
    POR_ALUNO = "por_aluno"  # cada tentativa sorteia seu próprio conjunto de questões
    TURMA_FIXA = "turma_fixa"  # sorteio único, compartilhado por todas as tentativas do simulado


class Papel(str, enum.Enum):
    PROFESSOR = "professor"
    COORDENACAO = "coordenacao"
    DIRECAO = "direcao"


class StatusFuncionario(str, enum.Enum):
    PENDENTE = "pendente"  # solicitou acesso, aguardando aprovação de alguém já ativo
    ATIVO = "ativo"
    RECUSADO = "recusado"


simulado_turma = Table(
    "simulado_turma",
    Base.metadata,
    Column("simulado_id", ForeignKey("simulados.id"), primary_key=True),
    Column("turma_id", ForeignKey("turmas.id"), primary_key=True),
)

funcionario_turma = Table(
    "funcionario_turma",
    Base.metadata,
    Column("funcionario_id", ForeignKey("funcionarios.id"), primary_key=True),
    Column("turma_id", ForeignKey("turmas.id"), primary_key=True),
)


class Turma(Base):
    __tablename__ = "turmas"

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False, unique=True)  # ex: "5A"
    etapa = Column(Integer, nullable=False)  # 3, 4 ou 5 (ano do fundamental)

    alunos = relationship("Aluno", back_populates="turma")
    simulados = relationship("Simulado", secondary=simulado_turma, back_populates="turmas_alvo")


class Funcionario(Base):
    """Professor, coordenação ou direção — login por e-mail institucional + senha
    (nunca RM/carteirinha: aqui o e-mail já é o identificador único)."""

    __tablename__ = "funcionarios"

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    papel = Column(Enum(Papel), nullable=False, default=Papel.PROFESSOR)
    senha_hash = Column(String, nullable=True)  # nulo enquanto status == pendente
    precisa_trocar_senha = Column(Boolean, nullable=False, default=True)
    status = Column(Enum(StatusFuncionario), nullable=False, default=StatusFuncionario.ATIVO)
    criado_em = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Só relevante pro papel "professor" — coordenação/direção enxergam todas as
    # turmas independentemente disso. Vazio = também enxerga todas (fallback).
    turmas = relationship("Turma", secondary=funcionario_turma)

    def pode_ver_tudo(self) -> bool:
        return self.papel in (Papel.COORDENACAO, Papel.DIRECAO)


class Aluno(Base):
    __tablename__ = "alunos"

    id = Column(Integer, primary_key=True)
    rm = Column(String, nullable=False, unique=True, index=True)
    nome = Column(String, nullable=False)
    turma_id = Column(Integer, ForeignKey("turmas.id"), nullable=False)

    turma = relationship("Turma", back_populates="alunos")
    tentativas = relationship("Tentativa", back_populates="aluno")


class Questao(Base):
    __tablename__ = "questoes"

    id = Column(Integer, primary_key=True)
    disciplina = Column(Enum(Disciplina), nullable=False)
    etapa = Column(Integer, nullable=False, default=5)  # ano do fundamental a que a questão pertence
    habilidade = Column(String, nullable=False)  # ex: "EF05LP03" ou código oficial "EF.05.MAT.1.83"
    descritor = Column(String, nullable=True)  # descrição textual da habilidade (Avalia+ SESI-SP)
    tipo_item = Column(Enum(TipoItem), nullable=False, default=TipoItem.ETAPA)
    ano_origem = Column(Integer, nullable=True)  # ano da prova de origem
    enunciado = Column(String, nullable=False)
    alternativas = Column(JSON, nullable=False)  # {"a": "...", "b": "...", "c": "...", "d": "..."}
    gabarito = Column(String, nullable=False)  # "a" | "b" | "c" | "d"
    dificuldade = Column(String, nullable=False, default="media")  # facil | media | dificil
    imagem_url = Column(String, nullable=True)  # recorte fiel do item original, quando aplicável
    comentario_pedagogico = Column(String, nullable=True)  # explicação exibida após a correção
    fonte = Column(String, nullable=True)  # ex: "Avalia+ SESI-SP — 1ª Aplicação 2026"


class SimuladoQuestao(Base):
    __tablename__ = "simulado_questoes"

    id = Column(Integer, primary_key=True)
    simulado_id = Column(Integer, ForeignKey("simulados.id"), nullable=False)
    questao_id = Column(Integer, ForeignKey("questoes.id"), nullable=False)
    ordem = Column(Integer, nullable=False, default=0)

    questao = relationship("Questao")


class Simulado(Base):
    __tablename__ = "simulados"

    id = Column(Integer, primary_key=True)
    titulo = Column(String, nullable=False)
    etapa = Column(Integer, nullable=False)
    trimestre = Column(Integer, nullable=False)
    tempo_limite_min = Column(Integer, nullable=False, default=60)
    janela_inicio = Column(DateTime, nullable=False)
    janela_fim = Column(DateTime, nullable=False)
    modo_sorteio = Column(Enum(ModoSorteio), nullable=False, default=ModoSorteio.POR_ALUNO)
    # usado apenas quando o simulado sorteia questões de um banco (em vez de lista fixa):
    qtd_matematica = Column(Integer, nullable=True)
    qtd_portugues = Column(Integer, nullable=True)

    turmas_alvo = relationship("Turma", secondary=simulado_turma, back_populates="simulados")
    questoes = relationship(
        "SimuladoQuestao", order_by=SimuladoQuestao.ordem, cascade="all, delete-orphan"
    )
    tentativas = relationship("Tentativa", back_populates="simulado")

    def disciplinas(self):
        if self.modo_sorteio == ModoSorteio.POR_ALUNO:
            disc = []
            if self.qtd_matematica:
                disc.append(Disciplina.MATEMATICA.value)
            if self.qtd_portugues:
                disc.append(Disciplina.PORTUGUES.value)
            return sorted(disc)
        return sorted({sq.questao.disciplina.value for sq in self.questoes})

    def sorteia_por_aluno(self) -> bool:
        return self.modo_sorteio == ModoSorteio.POR_ALUNO


class Tentativa(Base):
    __tablename__ = "tentativas"

    id = Column(Integer, primary_key=True)
    aluno_id = Column(Integer, ForeignKey("alunos.id"), nullable=False)
    simulado_id = Column(Integer, ForeignKey("simulados.id"), nullable=False)
    inicio = Column(DateTime, nullable=False, default=datetime.utcnow)
    fim = Column(DateTime, nullable=True)
    status = Column(Enum(StatusTentativa), nullable=False, default=StatusTentativa.EM_ANDAMENTO)
    nota_geral = Column(Float, nullable=True)  # % de acerto

    aluno = relationship("Aluno", back_populates="tentativas")
    simulado = relationship("Simulado", back_populates="tentativas")
    respostas = relationship("Resposta", back_populates="tentativa", cascade="all, delete-orphan")
    questoes_sorteadas = relationship(
        "TentativaQuestao", order_by="TentativaQuestao.ordem", cascade="all, delete-orphan"
    )

    def questoes_da_prova(self) -> list["Questao"]:
        if self.simulado.sorteia_por_aluno():
            return [tq.questao for tq in self.questoes_sorteadas]
        return [sq.questao for sq in self.simulado.questoes]


class TentativaQuestao(Base):
    __tablename__ = "tentativa_questoes"

    id = Column(Integer, primary_key=True)
    tentativa_id = Column(Integer, ForeignKey("tentativas.id"), nullable=False)
    questao_id = Column(Integer, ForeignKey("questoes.id"), nullable=False)
    ordem = Column(Integer, nullable=False, default=0)

    questao = relationship("Questao")


class PraticaRegistro(Base):
    """Uma questão respondida no modo treino (avulsa, fora de qualquer simulado
    cronometrado). Não gera nota — serve de controle/base para um futuro ranking
    de quem mais praticou."""

    __tablename__ = "pratica_registros"

    id = Column(Integer, primary_key=True)
    aluno_id = Column(Integer, ForeignKey("alunos.id"), nullable=False)
    questao_id = Column(Integer, ForeignKey("questoes.id"), nullable=False)
    alternativa_marcada = Column(String, nullable=True)
    acerto = Column(Boolean, nullable=False)
    pontos = Column(Integer, nullable=False, default=0)  # 0 se errou; base + bônus de sequência se acertou
    sequencia_no_momento = Column(Integer, nullable=False, default=0)  # acertos seguidos terminando aqui (0 se errou)
    criado_em = Column(DateTime, nullable=False, default=datetime.utcnow)

    aluno = relationship("Aluno")
    questao = relationship("Questao")


class Resposta(Base):
    __tablename__ = "respostas"

    id = Column(Integer, primary_key=True)
    tentativa_id = Column(Integer, ForeignKey("tentativas.id"), nullable=False)
    questao_id = Column(Integer, ForeignKey("questoes.id"), nullable=False)
    alternativa_marcada = Column(String, nullable=True)  # "a" | "b" | "c" | "d" | None
    marcada_para_revisao = Column(Boolean, nullable=False, default=False)
    acerto = Column(Boolean, nullable=True)  # calculado no envio

    tentativa = relationship("Tentativa", back_populates="respostas")
    questao = relationship("Questao")


class MetaInstitucional(Base):
    __tablename__ = "metas_institucionais"

    id = Column(Integer, primary_key=True)
    etapa = Column(Integer, nullable=False)
    disciplina = Column(Enum(Disciplina), nullable=False)
    trimestre = Column(Integer, nullable=False)
    valor_alvo_pct = Column(Float, nullable=False)  # ex: 70.0
