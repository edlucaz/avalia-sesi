"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SegmentoFala {
  id: string;
  texto: string;
}

type EstadoLeitor = "parado" | "lendo" | "pausado";

// Leitor de apoio (Web Speech API) para alunos que precisam de leitura em voz
// alta das questões. Fica só no navegador: nenhum áudio é gerado no servidor.
export function useLeitorDeApoio() {
  const [suportado, setSuportado] = useState(false);
  const [estado, setEstado] = useState<EstadoLeitor>("parado");
  const [segmentoAtual, setSegmentoAtual] = useState<string | null>(null);
  const vozRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSuportado(true);

    function escolherVoz() {
      const vozes = window.speechSynthesis.getVoices();
      vozRef.current =
        vozes.find((v) => v.lang === "pt-BR") ||
        vozes.find((v) => v.lang?.startsWith("pt")) ||
        null;
    }
    escolherVoz();
    window.speechSynthesis.addEventListener("voiceschanged", escolherVoz);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", escolherVoz);
  }, []);

  const parar = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setEstado("parado");
    setSegmentoAtual(null);
  }, []);

  const falar = useCallback((segmentos: SegmentoFala[]) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (!segmentos.length) return;

    segmentos.forEach((segmento, i) => {
      const utterance = new SpeechSynthesisUtterance(segmento.texto);
      utterance.lang = "pt-BR";
      utterance.rate = 0.95;
      if (vozRef.current) utterance.voice = vozRef.current;
      utterance.onstart = () => {
        setEstado("lendo");
        setSegmentoAtual(segmento.id);
      };
      if (i === segmentos.length - 1) {
        utterance.onend = () => {
          setEstado("parado");
          setSegmentoAtual(null);
        };
      }
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const pausar = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setEstado("pausado");
  }, []);

  const retomar = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
    setEstado("lendo");
  }, []);

  // Garante que a fala pare se o componente sair de tela (troca de rota etc).
  useEffect(() => parar, [parar]);

  return { suportado, estado, segmentoAtual, falar, pausar, retomar, parar };
}

export function segmentosDaQuestao(enunciado: string, alternativas: Record<string, string>): SegmentoFala[] {
  const segmentos: SegmentoFala[] = [{ id: "enunciado", texto: enunciado }];
  Object.entries(alternativas).forEach(([letra, texto]) => {
    segmentos.push({ id: letra, texto: `Alternativa ${letra.toUpperCase()}: ${texto}` });
  });
  return segmentos;
}
