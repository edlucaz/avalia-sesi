"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, ApiError } from "@/lib/api";
import { salvarSessao } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [rm, setRm] = useState("");
  const [turma, setTurma] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const resposta = await login(rm, turma);
      salvarSessao(resposta.access_token, resposta.aluno);
      router.push("/simulados");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="tela-boas-vindas">
      <div className="cartao">
        <div className="selo" style={{ marginBottom: 20, display: "inline-block" }}>
          SESI | SENAI
        </div>
        <h1>Avalia SESI</h1>
        <p className="subtitulo">Entre com seu RM e sua turma para ver os simulados.</p>

        {erro && <div className="erro">{erro}</div>}

        <form onSubmit={entrar}>
          <div className="campo">
            <label htmlFor="rm">Seu RM</label>
            <input
              id="rm"
              inputMode="numeric"
              placeholder="Ex: 50001"
              value={rm}
              onChange={(e) => setRm(e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="turma">Sua turma</label>
            <input
              id="turma"
              placeholder="Ex: 5A"
              value={turma}
              onChange={(e) => setTurma(e.target.value)}
              required
            />
          </div>
          <button className="botao-primario" type="submit" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
