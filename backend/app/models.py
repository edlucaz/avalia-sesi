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


simulado_turma = Table(
    "simulado_turma",
    Base.metadata,
    Column("simulado_id", ForeignKey("simulados.id"), primary_key=True),
    Column("turma_id", ForeignKey("turmas.id"), primary_key=True),
)


class Turma(Base):
    __tablename__ = "turmas"

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False, unique=True)  # ex: "5A"
    etapa = Column(Integer, nullable=False)  # 3, 4 ou 5 (ano do fundamental)

    alunos = relationship("Aluno", back_populates="turma")
    simulados = relationship("Simulado", secondary=simulado_turma, back_populates="turmas_alvo")


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
    habilidade = Column(String, nullable=False)  # ex: "EF05LP03"
    ano_origem = Column(Integer, nullable=True)  # ano da prova de origem
    enunciado = Column(String, nullable=False)
    alternativas = Column(JSON, nullable=False)  # {"a": "...", "b": "...", "c": "...", "d": "..."}
    gabarito = Column(String, nullable=False)  # "a" | "b" | "c" | "d"
    dificuldade = Column(String, nullable=False, default="media")  # facil | media | dificil


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

    turmas_alvo = relationship("Turma", secondary=simulado_turma, back_populates="simulados")
    questoes = relationship(
        "SimuladoQuestao", order_by=SimuladoQuestao.ordem, cascade="all, delete-orphan"
    )
    tentativas = relationship("Tentativa", back_populates="simulado")

    def disciplinas(self):
        return sorted({sq.questao.disciplina.value for sq in self.questoes})


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
