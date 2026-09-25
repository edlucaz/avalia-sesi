"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  VisaoGeralEscola,
  baixarCsvResultados,
  buscarVisaoGeral,
  cadastrarFuncionario,
} from "@/lib/api";
import { corDesempenho } from "@/lib/desempenho";

const NOME_DISCIPLINA: Record<string, string> = {
  portugues: "Português",
  matematica: "Matemática",
};

export default function PainelGestao({ token }: { token: string }) {
  const [visao, setVisao] = useState<VisaoGeralEscola | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  const [nomeNovo, setNomeNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [papelNovo, setPapelNovo] = useState<"professor" | "coordenacao" | "direcao">("professor");
  const [cadastrando, setCadastrando] = useState(false);
  const [erroCadastro, setErroCadastro] = useState<string | null>(null);
  const [sucessoCadastro, setSucessoCadastro] = useState<string | null>(null);

  useEffect(() => {
    buscarVisaoGeral(token)
      .then(setVisao)
      .catch((err) => setErro(err instanceof ApiError ? err.message : "Não foi possível carregar a visão geral."));
  }, [token]);

  async function baixarCsv() {
    setBaixando(true);
    try {
      await baixarCsvResultados(token);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível baixar o CSV.");
    } finally {
      setBaixando(false);
    }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErroCadastro(null);
    setSucessoCadastro(null);
    setCadastrando(true);
    try {
      const criado = await cadastrarFuncionario(token, {
        nome: nomeNovo.trim(),
        email: emailNovo.trim().toLowerCase(),
        papel: papelNovo,
      });
      setSucessoCadastro(`${criado.nome} cadastrado(a) — senha padrão da escola, troca no primeiro acesso.`);
      setNomeNovo("");
      setEmailNovo("");
    } catch (err) {
      setErroCadastro(
        err instanceof ApiError && err.status === 409
          ? "Já existe uma conta com esse e-mail."
          : "Não foi possível cadastrar."
      );
    } finally {
      setCadastrando(false);
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <h1>Visão geral da escola</h1>
      <p className="subtitulo">Todas as turmas, todos os simulados e o ranking de prática, num só lugar.</p>

      {erro && <div className="erro">{erro}</div>}

      {!visao ? (
        <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
            <button className="botao-secundario" style={{ width: "auto", padding: "10px 18px" }} onClick={baixarCsv} disabled={baixando}>
              {baixando ? "Gerando..." : "⬇ Baixar CSV com todos os resultados"}
            </button>
          </div>

          <h2>Turmas</h2>
          <table className="tabela-alunos" style={{ marginBottom: 28 }}>
            <thead>
              <tr>
                <th>Turma</th>
                <th>Alunos</th>
                <th>Concluíram (simulado mais recente)</th>
                <th>Nota média</th>
              </tr>
            </thead>
            <tbody>
              {visao.turmas.map((t) => (
                <tr key={t.turma}>
                  <td>{t.turma}</td>
                  <td>{t.total_alunos}</td>
                  <td>{t.total_concluidos}</td>
                  <td>{t.nota_media !== null ? `${t.nota_media}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Simulados (evolução ao longo do tempo)</h2>
          <table className="tabela-alunos" style={{ marginBottom: 28 }}>
            <thead>
              <tr>
                <th>Simulado</th>
                <th>Turmas</th>
                <th>Concluíram</th>
                <th>Nota média</th>
              </tr>
            </thead>
            <tbody>
              {visao.simulados.map((s) => (
                <tr key={s.id}>
                  <td>{s.titulo}</td>
                  <td>{s.turmas.join(", ")}</td>
                  <td>
                    {s.total_concluidos}/{s.total_elegiveis}
                  </td>
                  <td>{s.nota_media !== null ? `${s.nota_media}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {visao.ranking_habilidades_fracas.length > 0 && (
            <>
              <h2>Habilidades mais fracas (escola toda)</h2>
              {visao.ranking_habilidades_fracas.map((h) => (
                <div key={`${h.disciplina}-${h.habilidade}`} style={{ marginBottom: 10 }}>
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

          {visao.ranking_pratica.length > 0 && (
            <>
              <h2 style={{ marginTop: 28 }}>Quem mais praticou (modo treino)</h2>
              <table className="tabela-alunos" style={{ marginBottom: 28 }}>
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Turma</th>
                    <th>Questões respondidas</th>
                    <th>Acertos</th>
                  </tr>
                </thead>
                <tbody>
                  {visao.ranking_pratica.map((r) => (
                    <tr key={r.rm}>
                      <td>{r.aluno}</td>
                      <td>{r.turma}</td>
                      <td>{r.total_respondidas}</td>
                      <td>{r.total_acertos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--borda)" }} />

      <h1>Cadastrar professor ou gestor</h1>
      <p className="subtitulo">Cria a conta já ativa, com a senha padrão da escola (troca no primeiro acesso).</p>
      {erroCadastro && <div className="erro">{erroCadastro}</div>}
      {sucessoCadastro && (
        <div className="aviso-salvo" role="status" style={{ marginBottom: 12 }}>
          ✓ {sucessoCadastro}
        </div>
      )}
      <form onSubmit={cadastrar} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="campo" style={{ marginBottom: 0, flex: "1 1 200px" }}>
          <label htmlFor="nomeNovo">Nome</label>
          <input id="nomeNovo" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} required />
        </div>
        <div className="campo" style={{ marginBottom: 0, flex: "1 1 220px" }}>
          <label htmlFor="emailNovo">E-mail institucional</label>
          <input
            id="emailNovo"
            type="email"
            value={emailNovo}
            onChange={(e) => setEmailNovo(e.target.value)}
            required
          />
        </div>
        <div className="campo" style={{ marginBottom: 0, flex: "1 1 160px" }}>
          <label htmlFor="papelNovo">Papel</label>
          <select
            id="papelNovo"
            value={papelNovo}
            onChange={(e) => setPapelNovo(e.target.value as typeof papelNovo)}
          >
            <option value="professor">Professor(a)</option>
            <option value="coordenacao">Coordenação</option>
            <option value="direcao">Direção</option>
          </select>
        </div>
        <button className="botao-primario" style={{ width: "auto", padding: "12px 24px" }} disabled={cadastrando}>
          {cadastrando ? "Cadastrando..." : "Cadastrar"}
        </button>
      </form>

      <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--borda)" }} />
    </div>
  );
}
