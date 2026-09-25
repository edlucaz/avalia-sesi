"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ApiError,
  QuestaoProva,
  enviarTentativa,
  iniciarSimulado,
  responder,
  urlImagemQuestao,
} from "@/lib/api";
import { lerSessao } from "@/lib/session";
import { segmentosDaQuestao, useLeitorDeApoio } from "@/lib/leitor";

interface RespostaLocal {
  alternativa: string | null;
  revisao: boolean;
}

const LEITOR_AUTO_KEY = "avalia-sesi:leitor-auto";

function formatarTempo(segundos: number) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

export default function ProvaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [token, setToken] = useState<string | null>(null);
  const [tentativaId, setTentativaId] = useState<number | null>(null);
  const [questoes, setQuestoes] = useState<QuestaoProva[]>([]);
  const [respostas, setRespostas] = useState<Record<number, RespostaLocal>>({});
  const [indice, setIndice] = useState(0);
  const [tempoRestante, setTempoRestante] = useState<number | null>(null);
  const [tempoTotal, setTempoTotal] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [respostaSalva, setRespostaSalva] = useState(false);
  const [leitorAuto, setLeitorAuto] = useState(false);

  const enviandoRef = useRef(false);
  // Horário de término (relógio do aparelho): o contador é recalculado a partir
  // dele, então não atrasa quando o navegador pausa a aba ou a tela bloqueia.
  const fimEmRef = useRef<number | null>(null);
  const avisoSalvoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { suportado: leitorSuportado, estado: estadoLeitura, segmentoAtual, falar, pausar, retomar, parar } =
    useLeitorDeApoio();

  function avisarSalvo() {
    setRespostaSalva(true);
    if (avisoSalvoRef.current) clearTimeout(avisoSalvoRef.current);
    avisoSalvoRef.current = setTimeout(() => setRespostaSalva(false), 1500);
  }

  const finalizar = useCallback(async () => {
    if (!token || !tentativaId || enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      await enviarTentativa(token, tentativaId);
      router.replace(`/resultado/${tentativaId}`);
    } catch (err) {
      enviandoRef.current = false;
      setEnviando(false);
      setErroCarregamento(
        err instanceof ApiError ? err.message : "Não foi possível enviar. Tente de novo."
      );
    }
  }, [token, tentativaId, router]);

  useEffect(() => {
    const sessao = lerSessao();
    if (!sessao) {
      router.replace("/login");
      return;
    }
    setToken(sessao.token);
    iniciarSimulado(sessao.token, Number(params.id))
      .then((dados) => {
        setTentativaId(dados.tentativa_id);
        setQuestoes(dados.questoes);
        fimEmRef.current = Date.now() + dados.tempo_restante_seg * 1000;
        setTempoTotal(dados.tempo_limite_min * 60);
        setTempoRestante(dados.tempo_restante_seg);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 409) {
          router.replace("/simulados");
          return;
        }
        setErroCarregamento(
          err instanceof ApiError ? err.message : "Não foi possível carregar o simulado."
        );
      });
  }, [params.id, router]);

  useEffect(() => {
    setLeitorAuto(localStorage.getItem(LEITOR_AUTO_KEY) === "1");
  }, []);

  useEffect(() => {
    setRespostaSalva(false);
  }, [indice]);

  useEffect(() => {
    parar();
    if (!leitorAuto) return;
    const questao = questoes[indice];
    if (!questao) return;
    falar(segmentosDaQuestao(questao.enunciado, questao.alternativas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, leitorAuto, questoes]);

  useEffect(() => {
    if (confirmando) parar();
  }, [confirmando, parar]);

  function alternarLeitorAuto() {
    setLeitorAuto((atual) => {
      const novo = !atual;
      localStorage.setItem(LEITOR_AUTO_KEY, novo ? "1" : "0");
      if (!novo) parar();
      return novo;
    });
  }

  useEffect(() => {
    if (tempoRestante === null) return;
    if (tempoRestante <= 0) {
      finalizar();
      return;
    }
    const intervalo = setInterval(() => {
      if (fimEmRef.current === null) return;
      setTempoRestante(Math.max(0, Math.ceil((fimEmRef.current - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(intervalo);
  }, [tempoRestante, finalizar]);

  function marcarAlternativa(questaoId: number, letra: string) {
    setRespostas((atual) => {
      const anterior = atual[questaoId];
      const novaResposta = { alternativa: letra, revisao: anterior?.revisao || false };
      if (token && tentativaId) {
        responder(token, tentativaId, questaoId, letra, novaResposta.revisao)
          .then(avisarSalvo)
          .catch(() => {});
      }
      return { ...atual, [questaoId]: novaResposta };
    });
  }

  function alternarRevisao(questaoId: number) {
    setRespostas((atual) => {
      const anterior = atual[questaoId] || { alternativa: null, revisao: false };
      const novaResposta = { ...anterior, revisao: !anterior.revisao };
      if (token && tentativaId) {
        responder(
          token,
          tentativaId,
          questaoId,
          novaResposta.alternativa,
          novaResposta.revisao
        )
          .then(avisarSalvo)
          .catch(() => {});
      }
      return { ...atual, [questaoId]: novaResposta };
    });
  }

  if (erroCarregamento) {
    return (
      <div className="tela-boas-vindas">
        <div className="cartao">
          <div className="erro">{erroCarregamento}</div>
          <button className="botao-secundario" onClick={() => router.push("/simulados")}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!questoes.length || tempoRestante === null) {
    return (
      <div className="tela-boas-vindas" style={{ width: "100%" }}>
        <div style={{ maxWidth: 440, width: "100%" }}>
          <div className="skeleton" style={{ height: 48, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 60 }} />
        </div>
      </div>
    );
  }

  const questaoAtual = questoes[indice];
  const respostaAtual = respostas[questaoAtual.id];
  const totalRespondidas = Object.values(respostas).filter((r) => r.alternativa).length;
  const alertaTempo = tempoRestante <= 60;
  const avisoTempo = !alertaTempo && tempoRestante <= 5 * 60;
  const classeTempo = alertaTempo ? "alerta" : avisoTempo ? "aviso" : "";
  const pctTempo = tempoTotal ? Math.min(100, (tempoRestante / tempoTotal) * 100) : 100;

  return (
    <div className="tela-prova">
      <div className="topo-prova">
        <div className="barra-prova">
          <strong>{questaoAtual.disciplina === "portugues" ? "Português" : "Matemática"}</strong>
          <div
            className={`cronometro ${classeTempo}`}
            role="timer"
            aria-label={`Tempo restante: ${Math.ceil(tempoRestante / 60)} minutos`}
          >
            <span className="cronometro-rotulo">⏱ Tempo restante</span>
            <span className="cronometro-valor">{formatarTempo(tempoRestante)}</span>
          </div>
        </div>
        <div className="barra-tempo" aria-hidden="true">
          <div className={`barra-tempo-preenchida ${classeTempo}`} style={{ width: `${pctTempo}%` }} />
        </div>
        {avisoTempo && tempoRestante > 5 * 60 - 15 && (
          <div className="aviso-tempo" role="status">
            Faltam 5 minutos! Confira as questões que ainda estão em branco.
          </div>
        )}
      </div>

      <div className="grade-navegacao">
        {questoes.map((q, i) => {
          const r = respostas[q.id];
          let classe = "botao-questao";
          if (i === indice) classe += " atual";
          if (r?.revisao) classe += " revisao";
          else if (r?.alternativa) classe += " respondida";
          return (
            <button
              key={q.id}
              className={classe}
              onClick={() => setIndice(i)}
              aria-label={`Ir para a questão ${i + 1}${r?.alternativa ? ", respondida" : ""}${r?.revisao ? ", marcada para revisão" : ""}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="legenda">
        <span className="item">
          <span className="amostra atual" /> questão atual
        </span>
        <span className="item">
          <span className="amostra respondida" /> respondida
        </span>
        <span className="item">
          <span className="amostra revisao" /> marcada para revisão
        </span>
      </div>

      <div className="corpo-questao">
        <div className="contador-questao">
          Questão {indice + 1} de {questoes.length}
        </div>

        {leitorSuportado && (
          <div className="controle-leitor">
            <button
              type="button"
              className={`botao-leitor-auto ${leitorAuto ? "ativo" : ""}`}
              aria-pressed={leitorAuto}
              onClick={alternarLeitorAuto}
            >
              🔊 Leitor automático: {leitorAuto ? "ligado" : "desligado"}
            </button>

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
                  onClick={() =>
                    falar(segmentosDaQuestao(questaoAtual.enunciado, questaoAtual.alternativas))
                  }
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
          {questaoAtual.enunciado}
        </p>
        {questaoAtual.tem_imagem && token && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlImagemQuestao(questaoAtual.id, token)}
            alt="Apoio visual da questão"
            className="imagem-questao"
          />
        )}
        <div className="alternativas">
          {Object.entries(questaoAtual.alternativas).map(([letra, texto]) => (
            <button
              key={letra}
              className={`alternativa ${respostaAtual?.alternativa === letra ? "selecionada" : ""} ${segmentoAtual === letra ? "lendo" : ""}`}
              onClick={() => marcarAlternativa(questaoAtual.id, letra)}
            >
              <span className="letra">{letra.toUpperCase()}</span>
              <span>{texto}</span>
            </button>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, fontSize: 15 }}>
          <input
            type="checkbox"
            checked={respostaAtual?.revisao || false}
            onChange={() => alternarRevisao(questaoAtual.id)}
          />
          Marcar para revisar depois
        </label>

        <div className="aviso-salvo" role="status" aria-live="polite">
          {respostaSalva && <>✓ Resposta salva</>}
        </div>
      </div>

      <div className="rodape-prova">
        <button
          className="botao-secundario"
          style={{ width: "auto" }}
          disabled={indice === 0}
          onClick={() => setIndice((i) => Math.max(0, i - 1))}
        >
          Anterior
        </button>

        <span style={{ alignSelf: "center", fontSize: 14, color: "#667" }}>
          {totalRespondidas} de {questoes.length} respondidas
        </span>

        {indice < questoes.length - 1 ? (
          <button
            className="botao-primario"
            style={{ width: "auto", background: "var(--sesi-azul-marinho)" }}
            onClick={() => setIndice((i) => Math.min(questoes.length - 1, i + 1))}
          >
            Próxima
          </button>
        ) : (
          <button className="botao-primario" style={{ width: "auto" }} onClick={() => setConfirmando(true)}>
            Enviar prova
          </button>
        )}
      </div>

      {confirmando && (
        <div className="overlay">
          <div className="cartao" style={{ textAlign: "center" }}>
            <h1>Enviar prova?</h1>
            <p className="subtitulo">
              Você respondeu {totalRespondidas} de {questoes.length} questões. Depois de enviar,
              não é possível mudar as respostas.
            </p>
            <button className="botao-primario" onClick={finalizar} disabled={enviando}>
              {enviando ? "Enviando..." : "Sim, enviar"}
            </button>
            <div style={{ height: 10 }} />
            <button className="botao-secundario" onClick={() => setConfirmando(false)} disabled={enviando}>
              Voltar para a prova
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
