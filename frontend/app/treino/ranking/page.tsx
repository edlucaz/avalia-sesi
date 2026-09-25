"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  MeuProgressoTreino,
  RankingTreino,
  RankingTreinoItem,
  buscarMeuProgressoTreino,
  buscarRankingTreino,
} from "@/lib/api";
import { lerSessao } from "@/lib/session";
import Marca from "@/components/Marca";

function TabelaRanking({ itens, meuNome }: { itens: RankingTreinoItem[]; meuNome: string }) {
  return (
    <table className="tabela-alunos" style={{ marginBottom: 28 }}>
      <thead>
        <tr>
          <th>#</th>
          <th>Aluno</th>
          <th>Turma</th>
          <th>Pontos</th>
          <th>Faixa</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((i) => (
          <tr key={`${i.posicao}-${i.aluno}`} style={i.aluno === meuNome ? { fontWeight: 700 } : undefined}>
            <td>{i.posicao}</td>
            <td>{i.aluno}</td>
            <td>{i.turma}</td>
            <td>{i.pontos}</td>
            <td>{i.faixa}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RankingTreinoPage() {
  const router = useRouter();
  const [ranking, setRanking] = useState<RankingTreino | null>(null);
  const [progresso, setProgresso] = useState<MeuProgressoTreino | null>(null);
  const [meuNome, setMeuNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const sessao = lerSessao();
    if (!sessao) {
      router.replace("/login");
      return;
    }
    setMeuNome(sessao.aluno.nome);
    Promise.all([buscarRankingTreino(sessao.token), buscarMeuProgressoTreino(sessao.token)])
      .then(([r, p]) => {
        setRanking(r);
        setProgresso(p);
      })
      .catch((err) => setErro(err instanceof ApiError ? err.message : "Não foi possível carregar o ranking."));
  }, [router]);

  return (
    <div>
      <header className="cabecalho">
        <Marca />
        <button className="botao-secundario" style={{ width: "auto", padding: "8px 16px" }} onClick={() => router.push("/treino")}>
          ← Voltar ao treino
        </button>
      </header>

      <div className="pagina">
        <h1>Ranking do modo treino</h1>
        <p className="subtitulo">Pontos de quem mais praticou — não é nota, é só pra motivar.</p>

        {erro && <div className="erro">{erro}</div>}

        {progresso && (
          <div className="cartao" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: "#667" }}>Meu progresso</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              🏅 {progresso.faixa_atual} · {progresso.pontos_totais} pts
            </div>
            {progresso.proxima_faixa && (
              <div style={{ fontSize: 13, color: "#667" }}>
                Faltam {progresso.pontos_para_proxima} pts para {progresso.proxima_faixa}
              </div>
            )}
            <div style={{ fontSize: 13, color: "#667", marginTop: 6 }}>
              {progresso.total_acertos}/{progresso.total_respondidas} acertos · melhor sequência:{" "}
              {progresso.melhor_sequencia}
            </div>
            {progresso.selos.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {progresso.selos.map((s) => (
                  <span className="tag" key={s}>
                    🎖 {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!ranking ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : (
          <>
            <h2>
              Sua turma {ranking.posicao_turma ? `— você está em ${ranking.posicao_turma}º` : ""}
            </h2>
            <TabelaRanking itens={ranking.ranking_turma} meuNome={meuNome} />

            <h2>
              Toda a escola (5º ano) {ranking.posicao_escola ? `— você está em ${ranking.posicao_escola}º` : ""}
            </h2>
            <TabelaRanking itens={ranking.ranking_escola} meuNome={meuNome} />
          </>
        )}
      </div>
    </div>
  );
}
