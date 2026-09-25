from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_SECRET
from app.database import get_db
from app.models import Funcionario, StatusFuncionario

bearer_scheme_staff = HTTPBearer()

SENHA_PADRAO = "sesiararas2026"
TIPO_SESSAO_COMPLETA = "func"
TIPO_SESSAO_TROCA_SENHA = "func_troca_senha"


def hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def conferir_senha(senha: str, senha_hash: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), senha_hash.encode("utf-8"))
    except ValueError:
        return False


def criar_token_funcionario(funcionario_id: int, tipo: str = TIPO_SESSAO_COMPLETA) -> str:
    expira = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": str(funcionario_id), "tipo": tipo, "exp": expira}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _funcionario_do_token(token: str, tipo_esperado: str, db: Session) -> Funcionario:
    erro = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida ou expirada"
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("tipo") != tipo_esperado:
            raise erro
        funcionario_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise erro

    funcionario = db.query(Funcionario).filter(Funcionario.id == funcionario_id).first()
    if not funcionario or funcionario.status != StatusFuncionario.ATIVO:
        raise erro
    return funcionario


def funcionario_atual(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme_staff),
    db: Session = Depends(get_db),
) -> Funcionario:
    return _funcionario_do_token(credentials.credentials, TIPO_SESSAO_COMPLETA, db)


def funcionario_trocando_senha(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme_staff),
    db: Session = Depends(get_db),
) -> Funcionario:
    """Token de escopo restrito: só serve pra chamar /staff/trocar-senha, emitido
    quando o login ainda está com a senha padrão."""
    return _funcionario_do_token(credentials.credentials, TIPO_SESSAO_TROCA_SENHA, db)
