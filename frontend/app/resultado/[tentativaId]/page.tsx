"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, ResultadoTentativa, buscarResultado, urlImagemQuestao } from "@/lib/api";
import { corDesempenho } from "@/lib/desempenho";
import { lerSessao } from "@/lib/session";
import Marca from "@/components/Marca";

const NOME_DISCIPLINA: Record<string, string> = {
  portugues: "Português",
  matematica: "Matemática",
};

function mensagemMotivacional(nota: number): string {
  if (nota >= 80) return "Muito bem! Você mandou bem nesse simulado. 🎉";
  if (nota >= 50) return "Bom trabalho! Continue treinando para melhorar ainda mais.";
  return "Toda prática ajuda a aprender. Vamos treinar mais essas questões juntos.";
}

export default function ResultadoPage() {
  const router = useRouter();
  const params = useParams<{ tentativaId: string }>();
  const [resultado, setResultado] = useState<ResultadoTentativa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const sessao = lerSessao();
    if (!sessao) {
      router.replace("/login");
      return;
    }
    setToken(sessao.token);
    buscarResultado(sessao.token, Number(params.tentativaId))
      .then(setResultado)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Não foi possível carregar o resultado.")
      );
  }, [params.tentativaId, router]);

  if (erro) {
    return (
      <div className="tela-boas-vindas">
        <div className="cartao">
          <div className="erro">{erro}</div>
          <button className="botao-secundario" onClick={() => router.push("/simulados")}>
            Voltar aos simulados
          </button>
        </div>
      </div>
    );
  }

  if (!resultado) {
    return (
      <div className="pagina">
        <div className="skeleton" style={{ height: 140, marginBottom: 20 }} />
        <div className="skeleton skeleton-cartao" />
        <div className="skeleton skeleton-cartao" />
      </div>
    );
  }

  return (
    <div>
      <div className="resultado-cabecalho">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Marca tamanho="grande" />
        </div>
        <p className="subtitulo" style={{ marginBottom: 4 }}>
          {resultado.simulado_titulo}
        </p>
        <div className="nota-grande">{resultado.nota_geral}%</div>
        <p style={{ marginBottom: 4 }}>
          {resultado.total_acertos} de {resultado.total_questoes} questões corretas
        </p>
        <p className="mensagem-motivacional">{mensagemMotivacional(resultado.nota_geral)}</p>
      </div>

      <div className="pagina">
        <h2>Desempenho por habilidade</h2>
        {resultado.desempenho_por_habilidade.map((h) => (
          <div key={h.habilidade} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span>
                {h.habilidade} · {NOME_DISCIPLINA[h.disciplina] || h.disciplina}
              </span>
              <strong>
                {h.acertos}/{h.total} ({h.percentual}%)
              </strong>
            </div>
            <div className="barra-habilidade">
              <div style={{ width: `${h.percentual}%`, background: corDesempenho(h.percentual) }} />
            </div>
          </div>
        ))}

        <h2 style={{ marginTop: 32 }}>Gabarito comentado</h2>
        {resultado.questoes.map((q, i) => (
          <div className="questao-comentada" key={q.questao_id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="tag">
                Questão {i + 1} · {NOME_DISCIPLINA[q.disciplina] || q.disciplina}
                {q.descritor ? ` · ${q.descritor}` : ` · ${q.habilidade}`}
              </span>
              <span className={`badge-acerto ${q.acerto ? "certo" : "errado"}`}>
                {q.acerto ? "✓ Acertou" : "✗ Errou"}
              </span>
            </div>
            <p>{q.enunciado}</p>
            {q.tem_imagem && token && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlImagemQuestao(q.questao_id, token)}
                alt="Apoio visual da questão"
                className="imagem-questao"
              />
            )}
            <div style={{ fontSize: 14 }}>
              {Object.entries(q.alternativas).map(([letra, texto]) => {
                const ehGabarito = letra === q.gabarito;
                const ehMarcada = letra === q.alternativa_marcada;
                return (
                  <div
                    key={letra}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      marginBottom: 4,
                      background: ehGabarito ? "#e5f4ea" : ehMarcada ? "#fdecea" : "transparent",
                      fontWeight: ehGabarito || ehMarcada ? 600 : 400,
                    }}
                  >
                    {letra.toUpperCase()}) {texto}
                    {ehGabarito && " ✓ gabarito"}
                    {ehMarcada && !ehGabarito && " ✗ sua resposta"}
                  </div>
                );
              })}
              {!q.alternativa_marcada && (
                <div style={{ color: "#667", fontStyle: "italic" }}>Você não respondeu esta questão.</div>
              )}
            </div>
            {q.comentario_pedagogico && (
              <details className="comentario-pedagogico">
                <summary>Ver explicação</summary>
                <p>{q.comentario_pedagogico}</p>
              </details>
            )}
          </div>
        ))}

        <button className="botao-secundario" onClick={() => router.push("/simulados")}>
          Voltar aos simulados
        </button>
      </div>
    </div>
  );
}
