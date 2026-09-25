"""Importa alunos a partir da exportação "GridFrequencia.xls" do sistema escolar.

O arquivo exportado é, na verdade, uma tabela HTML com as colunas Nº, Aluno, RM.
Alunos são identificados pelo RM: se já existir, nome e turma são atualizados;
se não, o aluno é criado. Alunos que não estão na planilha não são apagados.

Os arquivos contêm dados pessoais de crianças — guarde-os em `dados_alunos/`
(ignorada pelo git) e nunca os versione.

Uso:
    python importar_alunos.py dados_alunos/GridFrequencia.xls 5A dados_alunos/GridFrequencia_1.xls 5B
    python importar_alunos.py --dry-run dados_alunos/GridFrequencia.xls 5A
"""

import sys
from html.parser import HTMLParser
from pathlib import Path


class _LeitorTabela(HTMLParser):
    """Lê só as linhas da tabela mais externa — a coluna "Lançamento" da exportação
    traz uma tabela aninhada dentro de cada célula."""

    def __init__(self):
        super().__init__()
        self.linhas: list[list[str]] = []
        self._linha: list[str] | None = None
        self._celula: list[str] | None = None
        self._profundidade = 0

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self._profundidade += 1
        elif self._profundidade != 1:
            return
        elif tag == "tr":
            self._linha = []
        elif tag in ("td", "th") and self._linha is not None:
            self._celula = []

    def handle_endtag(self, tag):
        if tag == "table":
            self._profundidade -= 1
        elif self._profundidade != 1:
            return
        elif tag in ("td", "th") and self._linha is not None and self._celula is not None:
            self._linha.append(" ".join("".join(self._celula).split()))
            self._celula = None
        elif tag == "tr" and self._linha is not None:
            self.linhas.append(self._linha)
            self._linha = None

    def handle_data(self, data):
        if self._celula is not None:
            self._celula.append(data)


def _ler_texto(caminho: Path) -> str:
    bruto = caminho.read_bytes()
    try:
        return bruto.decode("utf-8")
    except UnicodeDecodeError:
        return bruto.decode("latin-1")


def ler_alunos(caminho: Path) -> list[tuple[str, str]]:
    """Retorna [(rm, nome), ...] da planilha exportada."""
    leitor = _LeitorTabela()
    leitor.feed(_ler_texto(caminho))

    cabecalho_idx = next(
        (i for i, linha in enumerate(leitor.linhas) if "RM" in linha and "Aluno" in linha), None
    )
    if cabecalho_idx is None:
        raise ValueError(f"{caminho}: cabeçalho com as colunas 'Aluno' e 'RM' não encontrado")

    cabecalho = leitor.linhas[cabecalho_idx]
    col_nome, col_rm = cabecalho.index("Aluno"), cabecalho.index("RM")

    alunos = []
    for linha in leitor.linhas[cabecalho_idx + 1 :]:
        if len(linha) <= max(col_nome, col_rm):
            continue
        rm, nome = linha[col_rm].strip(), linha[col_nome].strip()
        if rm and nome:
            alunos.append((rm, nome))
    return alunos


def importar(pares: list[tuple[Path, str]], dry_run: bool = False) -> None:
    from app.database import Base, SessionLocal, engine
    from app.models import Aluno, Turma

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        vistos: dict[str, str] = {}
        for caminho, nome_turma in pares:
            turma = db.query(Turma).filter(Turma.nome == nome_turma.upper()).first()
            if not turma:
                raise SystemExit(f"Turma '{nome_turma}' não existe no banco.")

            criados = atualizados = iguais = 0
            for rm, nome in ler_alunos(caminho):
                if rm in vistos and vistos[rm] != turma.nome:
                    raise SystemExit(f"RM {rm} aparece em duas turmas ({vistos[rm]} e {turma.nome}).")
                vistos[rm] = turma.nome

                aluno = db.query(Aluno).filter(Aluno.rm == rm).first()
                if not aluno:
                    db.add(Aluno(rm=rm, nome=nome, turma_id=turma.id))
                    criados += 1
                elif aluno.nome != nome or aluno.turma_id != turma.id:
                    aluno.nome, aluno.turma_id = nome, turma.id
                    atualizados += 1
                else:
                    iguais += 1

            print(
                f"{caminho.name} → {turma.nome}: "
                f"{criados} novos, {atualizados} atualizados, {iguais} sem mudança"
            )

        if dry_run:
            db.rollback()
            print("(dry-run: nada foi gravado)")
        else:
            db.commit()
    finally:
        db.close()


def main(argv: list[str]) -> None:
    dry_run = "--dry-run" in argv
    args = [a for a in argv if a != "--dry-run"]
    if not args or len(args) % 2:
        raise SystemExit(__doc__)
    pares = [(Path(args[i]), args[i + 1]) for i in range(0, len(args), 2)]
    importar(pares, dry_run=dry_run)


if __name__ == "__main__":
    main(sys.argv[1:])
