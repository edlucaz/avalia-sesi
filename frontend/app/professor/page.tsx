"use client";

import { useState } from "react";
import { ApiError, PainelSimulado, buscarPainelProfessor } from "@/lib/api";
import { corDesempenho } from "@/lib/desempenho";
import Marca from "@/components/Marca";

const NOME_DISCIPLINA: Record<string, string> = {
  portugues: "Português",
  matematica: "Matemática",
};

export default function PainelProfessorPage() {
  const [tokenProfessor, setTokenProfessor] = useState("");
  const [mostrarToken, setMostrarToken] = useState(false);
  const [simuladoId, setSimuladoId] = useState("1");
  const [turma, setTurma] = useState("5A");
  const [painel, setPainel] = useState<PainelSimulado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    setPainel(null);
    try {
      const dados = await buscarPainelProfessor(tokenProfessor, Number(simuladoId), turma);
      setPainel(dados);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível carregar o painel.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <header className="cabecalho">
        <Marca />
        <span>Painel do professor</span>
      </header>

      <div className="pagina">
        <form
          onSubmit={buscar}
          style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 24 }}
        >
          <div className="campo campo-com-botao" style={{ marginBottom: 0, flex: "1 1 200px" }}>
            <label htmlFor="token">Token de acesso</label>
            <input
              id="token"
              type={mostrarToken ? "text" : "password"}
              value={tokenProfessor}
              onChange={(e) => setTokenProfessor(e.target.value)}
              required
            />
            <button
              type="button"
              className="botao-mostrar"
              onClick={() => setMostrarToken((v) => !v)}
              aria-label={mostrarToken ? "Ocultar token" : "Mostrar token"}
            >
              {mostrarToken ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          <div className="campo" style={{ marginBottom: 0, flex: "1 1 100px" }}>
            <label htmlFor="simuladoId">Simulado (ID)</label>
            <input id="simuladoId" value={simuladoId} onChange={(e) => setSimuladoId(e.target.value)} required />
          </div>
          <div className="campo" style={{ marginBottom: 0, flex: "1 1 100px" }}>
            <label htmlFor="turmaProfessor">Turma</label>
            <input id="turmaProfessor" value={turma} onChange={(e) => setTurma(e.target.value.toUpperCase())} required />
          </div>
          <button className="botao-primario" style={{ width: "auto", padding: "14px 24px" }} disabled={carregando}>
            {carregando ? "Buscando..." : "Ver painel"}
          </button>
        </form>

        {erro && <div className="erro">{erro}</div>}

        {carregando && (
          <div>
            <div className="skeleton" style={{ height: 32, width: 260, marginBottom: 24 }} />
            <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
              <div className="skeleton" style={{ height: 90, width: 180 }} />
              <div className="skeleton" style={{ height: 90, width: 180 }} />
              <div className="skeleton" style={{ height: 90, width: 180 }} />
            </div>
          </div>
        )}

        {painel && (
          <>
            <h1>{painel.titulo}</h1>
            <p className="subtitulo">Turma {painel.turma}</p>

            <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
              <div className="cartao" style={{ maxWidth: 180 }}>
                <div style={{ fontSize: 13, color: "#667" }}>Concluíram</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {painel.total_concluidos}/{painel.total_alunos}
                </div>
              </div>
              <div className="cartao" style={{ maxWidth: 180 }}>
                <div style={{ fontSize: 13, color: "#667" }}>Nota média</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {painel.nota_media !== null ? `${painel.nota_media}%` : "—"}
                </div>
              </div>
              <div className="cartao" style={{ maxWidth: 180 }}>
                <div style={{ fontSize: 13, color: "#667" }}>Meta institucional</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {painel.meta_institucional !== null ? `${painel.meta_institucional}%` : "—"}
                </div>
                {painel.nota_media !== null && painel.meta_institucional !== null && (
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: painel.nota_media >= painel.meta_institucional ? "var(--verde-acerto)" : "var(--vermelho-erro)",
                    }}
                  >
                    {painel.nota_media >= painel.meta_institucional ? "✓ Meta atingida" : "Abaixo da meta"}
                  </div>
                )}
              </div>
            </div>

            {painel.ranking_habilidades_mais_erradas.length > 0 && (
              <>
                <h2>Habilidades com mais erro</h2>
                {painel.ranking_habilidades_mais_erradas.map((h) => (
                  <div key={h.habilidade} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span>
                        {h.habilidade} · {NOME_DISCIPLINA[h.disciplina] || h.disciplina}
                      </span>
                      <strong>{h.percentual}% de acerto</strong>
                    </div>
                    <div className="barra-habilidade">
                      <div style={{ width: `${h.percentual}%`, background: corDesempenho(h.percentual) }} />
                    </div>
                  </div>
                ))}
              </>
            )}

            <h2 style={{ marginTop: 28 }}>Alunos</h2>
            <table className="tabela-alunos">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>RM</th>
                  <th>Status</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {painel.alunos.map((a) => (
                  <tr key={a.rm}>
                    <td>{a.aluno}</td>
                    <td>{a.rm}</td>
                    <td>
                      <span className={`status-pill ${a.status === "enviado" ? "enviado" : "nao-fez"}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>{a.nota_geral !== null ? `${a.nota_geral}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
