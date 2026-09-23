from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_SECRET
from app.database import get_db
from app.models import Aluno

bearer_scheme = HTTPBearer()


def criar_token(aluno_id: int) -> str:
    expira = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": str(aluno_id), "exp": expira}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _aluno_do_token(token: str, db: Session) -> Aluno:
    erro = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida ou expirada"
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        aluno_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise erro

    aluno = db.query(Aluno).filter(Aluno.id == aluno_id).first()
    if not aluno:
        raise erro
    return aluno


def aluno_atual(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Aluno:
    return _aluno_do_token(credentials.credentials, db)


def aluno_via_query_token(token: str, db: Session = Depends(get_db)) -> Aluno:
    """Mesma validação de `aluno_atual`, mas lendo o token da querystring — para
    uso em tags <img>, que não conseguem mandar um header Authorization."""
    return _aluno_do_token(token, db)
