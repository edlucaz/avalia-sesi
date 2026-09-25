from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_staff import (
    SENHA_PADRAO,
    TIPO_SESSAO_COMPLETA,
    TIPO_SESSAO_TROCA_SENHA,
    conferir_senha,
    criar_token_funcionario,
    funcionario_atual,
    funcionario_trocando_senha,
    hash_senha,
)
from app.database import get_db
from app.models import Funcionario, Papel, StatusFuncionario
from app.schemas import (
    FuncionarioOut,
    SolicitacaoOut,
    SolicitarAcessoRequest,
    StaffLoginRequest,
    StaffLoginResponse,
    TrocarSenhaRequest,
)

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.post("/login", response_model=StaffLoginResponse)
def login(payload: StaffLoginRequest, db: Session = Depends(get_db)):
    erro = HTTPException(status_code=401, detail="E-mail ou senha incorretos")

    funcionario = (
        db.query(Funcionario).filter(Funcionario.email == payload.email.strip().lower()).first()
    )
    if not funcionario:
        raise erro
    if funcionario.status == StatusFuncionario.PENDENTE:
        raise HTTPException(status_code=403, detail="Seu acesso ainda não foi aprovado")
    if funcionario.status == StatusFuncionario.RECUSADO or not funcionario.senha_hash:
        raise erro
    if not conferir_senha(payload.senha, funcionario.senha_hash):
        raise erro

    tipo = TIPO_SESSAO_TROCA_SENHA if funcionario.precisa_trocar_senha else TIPO_SESSAO_COMPLETA
    token = criar_token_funcionario(funcionario.id, tipo=tipo)
    return StaffLoginResponse(
        access_token=token,
        precisa_trocar_senha=funcionario.precisa_trocar_senha,
        funcionario=FuncionarioOut.model_validate(funcionario),
    )


@router.post("/trocar-senha", response_model=StaffLoginResponse)
def trocar_senha(
    payload: TrocarSenhaRequest,
    funcionario: Funcionario = Depends(funcionario_trocando_senha),
    db: Session = Depends(get_db),
):
    if len(payload.senha_nova) < 8:
        raise HTTPException(status_code=400, detail="A senha precisa ter ao menos 8 caracteres")

    funcionario.senha_hash = hash_senha(payload.senha_nova)
    funcionario.precisa_trocar_senha = False
    db.commit()

    token = criar_token_funcionario(funcionario.id, tipo=TIPO_SESSAO_COMPLETA)
    return StaffLoginResponse(
        access_token=token,
        precisa_trocar_senha=False,
        funcionario=FuncionarioOut.model_validate(funcionario),
    )


@router.get("/me", response_model=FuncionarioOut)
def me(funcionario: Funcionario = Depends(funcionario_atual)):
    return FuncionarioOut.model_validate(funcionario)


@router.post("/solicitar-acesso")
def solicitar_acesso(payload: SolicitarAcessoRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    existente = db.query(Funcionario).filter(Funcionario.email == email).first()
    if existente:
        raise HTTPException(status_code=409, detail="Já existe uma conta ou solicitação com esse e-mail")

    solicitacao = Funcionario(
        nome=payload.nome.strip(),
        email=email,
        papel=Papel.PROFESSOR,
        senha_hash=None,
        precisa_trocar_senha=True,
        status=StatusFuncionario.PENDENTE,
        criado_em=datetime.utcnow(),
    )
    db.add(solicitacao)
    db.commit()
    return {"detail": "Solicitação enviada. Assim que um professor ou gestor aprovar, você recebe acesso."}


@router.get("/solicitacoes", response_model=list[SolicitacaoOut])
def listar_solicitacoes(
    _funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    pendentes = (
        db.query(Funcionario)
        .filter(Funcionario.status == StatusFuncionario.PENDENTE)
        .order_by(Funcionario.criado_em)
        .all()
    )
    return [SolicitacaoOut.model_validate(p) for p in pendentes]


@router.post("/solicitacoes/{solicitacao_id}/aprovar", response_model=SolicitacaoOut)
def aprovar_solicitacao(
    solicitacao_id: int,
    _funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    solicitacao = (
        db.query(Funcionario)
        .filter(Funcionario.id == solicitacao_id, Funcionario.status == StatusFuncionario.PENDENTE)
        .first()
    )
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    solicitacao.status = StatusFuncionario.ATIVO
    solicitacao.senha_hash = hash_senha(SENHA_PADRAO)
    solicitacao.precisa_trocar_senha = True
    db.commit()
    return SolicitacaoOut.model_validate(solicitacao)


@router.post("/solicitacoes/{solicitacao_id}/recusar", response_model=SolicitacaoOut)
def recusar_solicitacao(
    solicitacao_id: int,
    _funcionario: Funcionario = Depends(funcionario_atual),
    db: Session = Depends(get_db),
):
    solicitacao = (
        db.query(Funcionario)
        .filter(Funcionario.id == solicitacao_id, Funcionario.status == StatusFuncionario.PENDENTE)
        .first()
    )
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    solicitacao.status = StatusFuncionario.RECUSADO
    db.commit()
    return SolicitacaoOut.model_validate(solicitacao)
