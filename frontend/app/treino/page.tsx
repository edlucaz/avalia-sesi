"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  QuestaoTreino,
  ResultadoTreino,
  proximaQuestaoTreino,
  responderTreino,
  urlImagemQuestao,
} from "@/lib/api";
import { lerSessao } from "@/lib/session";
import { segmentosDaQuestao, useLeitorDeApoio } from "@/lib/leitor";
import Marca from "@/components/Marca";

const NOME_DISCIPLINA: Record<string, string> = {
  portugues: "Português",
  matematica: "Matemática",
};

type Filtro = "" | "matematica" | "portugues";

export default function TreinoPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("");
  const [questao, setQuestao] = useState<QuestaoTreino | null>(null);
  const [alternativaEscolhida, setAlternativaEscolhida] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoTreino | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [respondendo, setRespondendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [placar, setPlacar] = useState({ acertos: 0, total: 0 });

  const { suportado: leitorSuportado, estado: estadoLeitura, segmentoAtual, falar, pausar, retomar, parar } =
    useLeitorDeApoio();

  async function carregarProxima(tk: string, disc: Filtro) {
    setCarregando(true);
    setErro(null);
    setResultado(null);
    setAlternativaEscolhida(null);
    parar();
    try {
      const dados = await proximaQuestaoTreino(tk, disc || undefined);
      setQuestao(dados);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível carregar uma questão.");
      setQuestao(null);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const sessao = lerSessao();
    if (!sessao) {
      router.replace("/login");
      return;
    }
    setToken(sessao.token);
    carregarProxima(sessao.token, filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function mudarFiltro(novo: Filtro) {
    setFiltro(novo);
    if (token) carregarProxima(token, novo);
  }

  async function responder(letra: string) {
    if (!token || !questao || respondendo || resultado) return;
    setAlternativaEscolhida(letra);
    setRespondendo(true);
    parar();
    try {
      const res = await responderTreino(token, questao.questao_id, letra);
      setResultado(res);
      setPlacar((p) => ({ acertos: p.acertos + (res.acerto ? 1 : 0), total: p.total + 1 }));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível registrar a resposta.");
    } finally {
      setRespondendo(false);
    }
  }

  function proxima() {
    if (token) carregarProxima(token, filtro);
  }

  return (
    <div>
      <header className="cabecalho">
        <Marca />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span>
            Acertos: {placar.acertos}/{placar.total}
          </span>
          <button
            className="botao-secundario"
            style={{ width: "auto", padding: "8px 16px" }}
            onClick={() => router.push("/simulados")}
          >
            Encerrar treino
          </button>
        </div>
      </header>

      <div className="pagina">
        <h1>Modo treino</h1>
        <p className="subtitulo">
          Uma questão de cada vez, do banco do seu ano — a resolução aparece assim que você
          responde. Não vale nota, é só pra praticar.
        </p>

        <div className="turma-tabs" style={{ marginBottom: 20 }}>
          {(["", "matematica", "portugues"] as Filtro[]).map((f) => (
            <button
              key={f || "todas"}
              className={`turma-tab ${filtro === f ? "active" : ""}`}
              onClick={() => mudarFiltro(f)}
            >
              {f ? NOME_DISCIPLINA[f] : "Todas"}
            </button>
          ))}
        </div>

        {erro && <div className="erro">{erro}</div>}

        {carregando && (
          <div>
            <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 60 }} />
          </div>
        )}

        {!carregando && questao && (
          <div className="corpo-questao">
            <div className="contador-questao">{NOME_DISCIPLINA[questao.disciplina] || questao.disciplina}</div>

            {leitorSuportado && (
              <div className="controle-leitor">
                <div className="botoes-reproducao">
                  {estadoLeitura === "lendo" ? (
                    <button type="button" className="botao-reproducao" onClick={pausar}>
                      ⏸ Pausar
                    </button>
                  ) : estadoLeitura === "pausado" ? (
                    <button type="button" className="botao-reproducao" onClick={retomar}>
                      ▶ Continuar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="botao-reproducao"
                      onClick={() => falar(segmentosDaQuestao(questao.enunciado, questao.alternativas))}
                    >
                      ▶ Ouvir questão
                    </button>
                  )}
                  {estadoLeitura !== "parado" && (
                    <button type="button" className="botao-reproducao secundario" onClick={parar}>
                      ⏹ Parar
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className={`enunciado ${segmentoAtual === "enunciado" ? "lendo" : ""}`}>
              {questao.enunciado}
            </p>
            {questao.tem_imagem && token && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlImagemQuestao(questao.questao_id, token)}
                alt="Apoio visual da questão"
                className="imagem-questao"
              />
            )}

            <div className="alternativas">
              {Object.entries(questao.alternativas).map(([letra, texto]) => {
                const ehEscolhida = alternativaEscolhida === letra;
                const ehGabarito = resultado && letra === resultado.gabarito;
                const ehErrada = resultado && ehEscolhida && !resultado.acerto;
                let estilo: React.CSSProperties = {};
                if (ehGabarito) estilo = { background: "#e5f4ea", borderColor: "var(--verde-acerto, #2e7d32)" };
                else if (ehErrada) estilo = { background: "#fdecea", borderColor: "var(--vermelho-erro, #c62828)" };
                return (
                  <button
                    key={letra}
                    className={`alternativa ${ehEscolhida ? "selecionada" : ""} ${segmentoAtual === letra ? "lendo" : ""}`}
                    style={estilo}
                    disabled={!!resultado || respondendo}
                    onClick={() => responder(letra)}
                  >
                    <span className="letra">{letra.toUpperCase()}</span>
                    <span>{texto}</span>
                    {ehGabarito && " ✓ gabarito"}
                    {ehErrada && " ✗ sua resposta"}
                  </button>
                );
              })}
            </div>

            {resultado && (
              <div style={{ marginTop: 20 }}>
                <div className={`badge-acerto ${resultado.acerto ? "certo" : "errado"}`}>
                  {resultado.acerto ? "✓ Acertou" : "✗ Errou"}
                </div>
                {resultado.descritor && (
                  <p style={{ fontSize: 13, color: "#667", marginTop: 8 }}>{resultado.descritor}</p>
                )}
                {resultado.comentario_pedagogico && (
                  <p style={{ fontSize: 14, marginTop: 8, whiteSpace: "pre-line" }}>
                    {resultado.comentario_pedagogico}
                  </p>
                )}
                <button
                  className="botao-primario"
                  style={{ width: "auto", padding: "12px 22px", marginTop: 16 }}
                  onClick={proxima}
                >
                  Próxima questão
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
