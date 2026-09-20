"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listarSimulados, SimuladoResumo } from "@/lib/api";
import { lerSessao, limparSessao } from "@/lib/session";

const NOME_DISCIPLINA: Record<string, string> = {
  portugues: "Português",
  matematica: "Matemática",
};

export default function ListaSimuladosPage() {
  const router = useRouter();
  const [simulados, setSimulados] = useState<SimuladoResumo[] | null>(null);
  const [nomeAluno, setNomeAluno] = useState("");

  useEffect(() => {
    const sessao = lerSessao();
    if (!sessao) {
      router.replace("/login");
      return;
    }
    setNomeAluno(sessao.aluno.nome);
    listarSimulados(sessao.token)
      .then(setSimulados)
      .catch(() => setSimulados([]));
  }, [router]);

  function sair() {
    limparSessao();
    router.replace("/login");
  }

  return (
    <div>
      <header className="cabecalho">
        <div className="selo">SESI | SENAI</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span>{nomeAluno}</span>
          <button className="botao-secundario" style={{ width: "auto", padding: "8px 16px" }} onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <div className="pagina">
        <h1>Seus simulados</h1>
        <p className="subtitulo">Escolha um simulado disponível para começar.</p>

        {simulados === null && (
          <div className="lista-simulados">
            <div className="skeleton skeleton-cartao" />
            <div className="skeleton skeleton-cartao" />
          </div>
        )}

        {simulados?.length === 0 && (
          <div className="estado-vazio">
            <div className="icone">🗓️</div>
            <p>
              <strong>Nenhum simulado disponível agora.</strong>
            </p>
            <p>Assim que seu professor liberar um novo simulado, ele aparece aqui.</p>
          </div>
        )}

        <div className="lista-simulados">
          {simulados?.map((s) => (
            <div className="item-simulado" key={s.id}>
              <div>
                <h3>{s.titulo}</h3>
                <div className="meta">
                  {s.disciplinas.map((d) => (
                    <span className="tag" key={d}>
                      {NOME_DISCIPLINA[d] || d}
                    </span>
                  ))}
                  {s.ja_respondido && <span className="tag tag-concluido">Concluído</span>}
                </div>
                <div className="meta" style={{ marginTop: 6 }}>
                  Tempo: {s.tempo_limite_min} min
                </div>
              </div>
              <button
                className="botao-primario"
                style={{ width: "auto", padding: "12px 22px" }}
                disabled={s.ja_respondido}
                onClick={() => router.push(`/simulados/${s.id}`)}
              >
                {s.ja_respondido ? "Feito" : "Começar"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
