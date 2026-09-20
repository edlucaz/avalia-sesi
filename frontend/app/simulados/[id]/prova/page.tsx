"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ApiError,
  QuestaoProva,
  enviarTentativa,
  iniciarSimulado,
  responder,
} from "@/lib/api";
import { lerSessao } from "@/lib/session";

interface RespostaLocal {
  alternativa: string | null;
  revisao: boolean;
}

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
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const enviandoRef = useRef(false);

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
    if (tempoRestante === null) return;
    if (tempoRestante <= 0) {
      finalizar();
      return;
    }
    const intervalo = setInterval(() => {
      setTempoRestante((atual) => (atual !== null ? atual - 1 : atual));
    }, 1000);
    return () => clearInterval(intervalo);
  }, [tempoRestante, finalizar]);

  function marcarAlternativa(questaoId: number, letra: string) {
    setRespostas((atual) => {
      const anterior = atual[questaoId];
      const novaResposta = { alternativa: letra, revisao: anterior?.revisao || false };
      if (token && tentativaId) {
        responder(token, tentativaId, questaoId, letra, novaResposta.revisao).catch(() => {});
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
        ).catch(() => {});
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
      <div className="tela-boas-vindas">
        <p>Carregando prova...</p>
      </div>
    );
  }

  const questaoAtual = questoes[indice];
  const respostaAtual = respostas[questaoAtual.id];
  const totalRespondidas = Object.values(respostas).filter((r) => r.alternativa).length;
  const alertaTempo = tempoRestante <= 60;

  return (
    <div className="tela-prova">
      <div className="barra-prova">
        <strong>{questaoAtual.disciplina === "portugues" ? "Português" : "Matemática"}</strong>
        <span className={`cronometro ${alertaTempo ? "alerta" : ""}`}>
          {formatarTempo(tempoRestante)}
        </span>
      </div>

      <div className="grade-navegacao">
        {questoes.map((q, i) => {
          const r = respostas[q.id];
          let classe = "botao-questao";
          if (i === indice) classe += " atual";
          if (r?.revisao) classe += " revisao";
          else if (r?.alternativa) classe += " respondida";
          return (
            <button key={q.id} className={classe} onClick={() => setIndice(i)}>
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="corpo-questao">
        <p className="enunciado">{questaoAtual.enunciado}</p>
        <div className="alternativas">
          {Object.entries(questaoAtual.alternativas).map(([letra, texto]) => (
            <button
              key={letra}
              className={`alternativa ${respostaAtual?.alternativa === letra ? "selecionada" : ""}`}
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
