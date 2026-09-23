from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import aluno_via_query_token
from app.database import get_db
from app.models import Aluno, Questao

router = APIRouter(prefix="/api/questoes", tags=["questoes"])

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets" / "questoes"


@router.get("/{questao_id}/imagem")
def imagem_questao(
    questao_id: int,
    _aluno: Aluno = Depends(aluno_via_query_token),
    db: Session = Depends(get_db),
):
    questao = db.query(Questao).filter(Questao.id == questao_id).first()
    if not questao or not questao.imagem_url:
        raise HTTPException(status_code=404, detail="Imagem não encontrada")

    caminho = (ASSETS_DIR / questao.imagem_url).resolve()
    if ASSETS_DIR.resolve() not in caminho.parents or not caminho.is_file():
        raise HTTPException(status_code=404, detail="Imagem não encontrada")

    return FileResponse(caminho, media_type="image/png")
