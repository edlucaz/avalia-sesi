"use client";

import { useEffect, useState } from "react";

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Botão explícito de instalação, em vez do popup automático do navegador:
// o Chrome dispara "beforeinstallprompt" por conta própria, mas isso vira um
// popup fora do nosso controle — aqui a gente intercepta (preventDefault) e só
// mostra o prompt quando a pessoa clica neste botão.
export default function BotaoInstalarApp() {
  const [eventoInstalacao, setEventoInstalacao] = useState<EventoInstalacao | null>(null);
  const [jaInstalado, setJaInstalado] = useState(false);
  const [ehIOS, setEhIOS] = useState(false);
  const [instrucoesIOS, setInstrucoesIOS] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setJaInstalado(true);
      return;
    }
    setEhIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    function aoFicarInstalavel(e: Event) {
      e.preventDefault();
      setEventoInstalacao(e as EventoInstalacao);
    }
    window.addEventListener("beforeinstallprompt", aoFicarInstalavel);

    function aoInstalar() {
      setJaInstalado(true);
      setEventoInstalacao(null);
    }
    window.addEventListener("appinstalled", aoInstalar);

    return () => {
      window.removeEventListener("beforeinstallprompt", aoFicarInstalavel);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (jaInstalado) return null;
  if (!eventoInstalacao && !ehIOS) return null;

  async function instalar() {
    if (!eventoInstalacao) {
      setInstrucoesIOS(true);
      return;
    }
    await eventoInstalacao.prompt();
    await eventoInstalacao.userChoice;
    setEventoInstalacao(null);
  }

  return (
    <div style={{ marginTop: 18, textAlign: "center" }}>
      <button
        type="button"
        className="botao-secundario"
        style={{ width: "auto", padding: "10px 20px" }}
        onClick={instalar}
      >
        📲 Instalar o app no celular
      </button>
      {instrucoesIOS && (
        <p style={{ fontSize: 13, color: "#667", marginTop: 8 }}>
          No iPhone: toque em <strong>Compartilhar</strong> na barra do Safari e depois em{" "}
          <strong>Adicionar à Tela de Início</strong>.
        </p>
      )}
    </div>
  );
}
