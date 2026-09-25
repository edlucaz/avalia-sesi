"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  Funcionario,
  PainelSimulado,
  SimuladoCriado,
  SolicitacaoAcesso,
  TurmaOut,
  aprovarSolicitacao,
  buscarPainelProfessor,
  criarSimuladoProfessor,
  listarSimuladosProfessor,
  listarSolicitacoes,
  listarTurmasProfessor,
  recusarSolicitacao,
} from "@/lib/api";
import { corDesempenho } from "@/lib/desempenho";
import { lerSessaoStaff, limparSessaoStaff } from "@/lib/session";
import Marca from "@/components/Marca";
import PainelGestao from "@/components/PainelGestao";

const NOME_DISCIPLINA: Record<string, string> = {
  portugues: "Português",
  matematica: "Matemática",
};

const NOME_PAPEL: Record<string, string> = {
  professor: "Professor(a)",
  coordenacao: "Coordenação",
  direcao: "Direção",
};

export default function PainelProfessorPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);

  const [simuladoId, setSimuladoId] = useState("1");
  const [turma, setTurma] = useState("5A");
  const [painel, setPainel] = useState<PainelSimulado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const [turmasDisponiveis, setTurmasDisponiveis] = useState<TurmaOut[]>([]);
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);
  const [tituloNovo, setTituloNovo] = useState("Simulado Avalia+");
  const [etapaNovo, setEtapaNovo] = useState("5");
  const [qtdMt, setQtdMt] = useState("5");
  const [qtdLp, setQtdLp] = useState("5");
  const [tempoLimiteNovo, setTempoLimiteNovo] = useState("30");
  const [diasDisponivel, setDiasDisponivel] = useState("30");
  const [modoSorteioNovo, setModoSorteioNovo] = useState<"por_aluno" | "turma_fixa">("turma_fixa");
  const [simuladosExistentes, setSimuladosExistentes] = useState<SimuladoCriado[] | null>(null);
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const [sucessoCriar, setSucessoCriar] = useState<SimuladoCriado | null>(null);

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAcesso[] | null>(null);
  const [processandoSolicitacao, setProcessandoSolicitacao] = useState<number | null>(null);

  useEffect(() => {
    const sessao = lerSessaoStaff();
    if (!sessao) {
      router.replace("/login");
      return;
    }
    setToken(sessao.token);
    setFuncionario(sessao.funcionario);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    carregarTudo(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function carregarTudo(tk: string) {
    try {
      const [turmasRes, simuladosRes, solicitacoesRes] = await Promise.all([
        listarTurmasProfessor(tk),
        listarSimuladosProfessor(tk),
        listarSolicitacoes(tk),
      ]);
      setTurmasDisponiveis(turmasRes);
      setSimuladosExistentes(simuladosRes);
      setSolicitacoes(solicitacoesRes);
    } catch (err) {
      setErroCriar(err instanceof ApiError ? err.message : "Não foi possível carregar os dados.");
    }
  }

  function sair() {
    limparSessaoStaff();
    router.replace("/login");
  }

  async function processarSolicitacao(id: number, aprovar: boolean) {
    if (!token) return;
    setProcessandoSolicitacao(id);
    try {
      if (aprovar) await aprovarSolicitacao(token, id);
      else await recusarSolicitacao(token, id);
      setSolicitacoes(await listarSolicitacoes(token));
    } catch (err) {
      setErroCriar(err instanceof ApiError ? err.message : "Não foi possível processar a solicitação.");
    } finally {
      setProcessandoSolicitacao(null);
    }
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErro(null);
    setCarregando(true);
    setPainel(null);
    try {
      const dados = await buscarPainelProfessor(token, Number(simuladoId), turma);
      setPainel(dados);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível carregar o painel.");
    } finally {
      setCarregando(false);
    }
  }

  function alternarTurmaSelecionada(nome: string) {
    setTurmasSelecionadas((atual) =>
      atual.includes(nome) ? atual.filter((t) => t !== nome) : [...atual, nome]
    );
  }

  async function criarSimulado(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErroCriar(null);
    setSucessoCriar(null);
    if (!turmasSelecionadas.length) {
      setErroCriar("Selecione ao menos uma turma.");
      return;
    }
    setCriando(true);
    try {
      const criado = await criarSimuladoProfessor(token, {
        titulo: tituloNovo,
        etapa: Number(etapaNovo),
        turmas: turmasSelecionadas,
        qtd_matematica: Number(qtdMt),
        qtd_portugues: Number(qtdLp),
        tempo_limite_min: Number(tempoLimiteNovo),
        dias_disponivel: Number(diasDisponivel),
        modo_sorteio: modoSorteioNovo,
      });
      setSucessoCriar(criado);
      setSimuladosExistentes(await listarSimuladosProfessor(token));
    } catch (err) {
      setErroCriar(err instanceof ApiError ? err.message : "Não foi possível criar o simulado.");
    } finally {
      setCriando(false);
    }
  }

  if (!funcionario) return null;

  return (
    <div>
      <header className="cabecalho">
        <Marca />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span>
            {funcionario.nome} · {NOME_PAPEL[funcionario.papel] || funcionario.papel}
          </span>
          <button className="botao-secundario" style={{ width: "auto", padding: "8px 16px" }} onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <div className="pagina">
        {funcionario.papel !== "professor" && token && <PainelGestao token={token} />}

        {solicitacoes && solicitacoes.length > 0 && (
          <>
            <h1>Solicitações de acesso</h1>
            <p className="subtitulo">Pedidos de professores novos aguardando aprovação.</p>
            <table className="tabela-alunos" style={{ marginBottom: 32 }}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.map((s) => (
                  <tr key={s.id}>
                    <td>{s.nome}</td>
                    <td>{s.email}</td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button
                        className="botao-primario"
                        style={{ width: "auto", padding: "6px 14px", fontSize: 13 }}
                        disabled={processandoSolicitacao === s.id}
                        onClick={() => processarSolicitacao(s.id, true)}
                      >
                        Aprovar
                      </button>
                      <button
                        className="botao-secundario"
                        style={{ width: "auto", padding: "6px 14px", fontSize: 13 }}
                        disabled={processandoSolicitacao === s.id}
                        onClick={() => processarSolicitacao(s.id, false)}
                      >
                        Recusar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h1>Lançar simulado</h1>
        <p className="subtitulo">Escolha as turmas e configure o sorteio (padrão: mesmas questões pra turma toda).</p>

        {erroCriar && <div className="erro">{erroCriar}</div>}
        {sucessoCriar && (
          <div className="aviso-salvo" role="status" style={{ marginBottom: 12 }}>
            ✓ Simulado #{sucessoCriar.id} "{sucessoCriar.titulo}" criado para {sucessoCriar.turmas.join(", ")}
          </div>
        )}

        {turmasDisponiveis.length > 0 && (
          <form onSubmit={criarSimulado} style={{ marginBottom: 32 }}>
            <div className="campo">
              <label htmlFor="tituloNovo">Título</label>
              <input id="tituloNovo" value={tituloNovo} onChange={(e) => setTituloNovo(e.target.value)} required />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {turmasDisponiveis.map((t) => (
                <button
                  type="button"
                  key={t.nome}
                  className={`turma-tab ${turmasSelecionadas.includes(t.nome) ? "active" : ""}`}
                  onClick={() => alternarTurmaSelecionada(t.nome)}
                >
                  {t.nome}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="campo" style={{ flex: "1 1 100px" }}>
                <label htmlFor="etapaNovo">Ano (etapa)</label>
                <input id="etapaNovo" value={etapaNovo} onChange={(e) => setEtapaNovo(e.target.value)} required />
              </div>
              <div className="campo" style={{ flex: "1 1 100px" }}>
                <label htmlFor="qtdMt">Nº questões Matemática</label>
                <input id="qtdMt" value={qtdMt} onChange={(e) => setQtdMt(e.target.value)} required />
              </div>
              <div className="campo" style={{ flex: "1 1 100px" }}>
                <label htmlFor="qtdLp">Nº questões Português</label>
                <input id="qtdLp" value={qtdLp} onChange={(e) => setQtdLp(e.target.value)} required />
              </div>
              <div className="campo" style={{ flex: "1 1 100px" }}>
                <label htmlFor="tempoLimiteNovo">Tempo (min)</label>
                <input
                  id="tempoLimiteNovo"
                  value={tempoLimiteNovo}
                  onChange={(e) => setTempoLimiteNovo(e.target.value)}
                  required
                />
              </div>
              <div className="campo" style={{ flex: "1 1 120px" }}>
                <label htmlFor="diasDisponivel">Disponível por (dias)</label>
                <input
                  id="diasDisponivel"
                  value={diasDisponivel}
                  onChange={(e) => setDiasDisponivel(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="campo" style={{ marginTop: 12 }}>
              <label htmlFor="modoSorteioNovo">Modo de sorteio</label>
              <select
                id="modoSorteioNovo"
                value={modoSorteioNovo}
                onChange={(e) => setModoSorteioNovo(e.target.value as "por_aluno" | "turma_fixa")}
              >
                <option value="turma_fixa">Turma fixa — todo mundo recebe o mesmo sorteio</option>
                <option value="por_aluno">Por aluno — cada um recebe um sorteio próprio</option>
              </select>
            </div>

            <button
              className="botao-primario"
              style={{ width: "auto", padding: "12px 24px", marginTop: 16 }}
              disabled={criando}
            >
              {criando ? "Criando..." : "Lançar simulado"}
            </button>
          </form>
        )}

        {simuladosExistentes && simuladosExistentes.length > 0 && (
          <>
            <h2>Simulados já lançados</h2>
            <table className="tabela-alunos" style={{ marginBottom: 32 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Turmas</th>
                  <th>Sorteio</th>
                  <th>Disponível até</th>
                </tr>
              </thead>
              <tbody>
                {simuladosExistentes.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.titulo}</td>
                    <td>{s.turmas.join(", ")}</td>
                    <td>{s.modo_sorteio === "por_aluno" ? "Por aluno" : "Turma fixa"}</td>
                    <td>{new Date(s.janela_fim).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <hr style={{ margin: "28px 0", border: "none", borderTop: "1px solid var(--borda)" }} />

        <h1>Ver painel de resultados</h1>
        <form
          onSubmit={buscar}
          style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 24 }}
        >
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
