"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function FormularioAcesso() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const resp = await fetch("/api/acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!resp.ok) {
        setErro("Senha incorreta.");
        return;
      }
      const proximo = searchParams.get("proximo") || "/";
      router.replace(proximo);
      router.refresh();
    } catch {
      setErro("Não foi possível verificar a senha. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-boas-vindas">
      <div className="cartao">
        <h1>Acesso restrito</h1>
        <p className="subtitulo">Este ambiente ainda está em preparação. Digite a senha para entrar.</p>

        {erro && <div className="erro">{erro}</div>}

        <form onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
              required
            />
          </div>
          <button className="botao-primario" type="submit" disabled={enviando}>
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AcessoPage() {
  return (
    <Suspense fallback={null}>
      <FormularioAcesso />
    </Suspense>
  );
}
