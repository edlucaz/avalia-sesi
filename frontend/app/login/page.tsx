"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, listarTurmas, ApiError } from "@/lib/api";
import { salvarSessao } from "@/lib/session";
import Marca from "@/components/Marca";
import BotaoInstalarApp from "@/components/BotaoInstalarApp";
import StaffLoginForm from "@/components/StaffLoginForm";

export default function LoginPage() {
  const router = useRouter();
  const [rm, setRm] = useState("");
  const [turma, setTurma] = useState("");
  const [turmas, setTurmas] = useState<string[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modoStaff, setModoStaff] = useState(false);

  useEffect(() => {
    listarTurmas()
      .then((lista) => {
        setTurmas(lista);
        if (lista.length) setTurma(lista[0]);
      })
      .catch(() => setTurmas([]));
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const resposta = await login(rm, turma);
      salvarSessao(resposta.access_token, resposta.aluno);
      router.push("/simulados");
    } catch (err) {
      setErro(
        err instanceof ApiError && err.status === 401
          ? "RM ou turma incorretos. Confira com seu professor e tente de novo."
          : "Não foi possível entrar. Tente de novo."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="tela-boas-vindas">
      <div className="cartao">
        <div style={{ marginBottom: 20 }}>
          <Marca tamanho="grande" />
        </div>
        <h1>Avalia SESI</h1>

        {modoStaff ? (
          <StaffLoginForm onVoltar={() => setModoStaff(false)} />
        ) : (
          <>
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
                  autoFocus
                />
              </div>
              <div className="campo">
                <label htmlFor="turma">Sua turma</label>
                {turmas === null ? (
                  <div className="skeleton" style={{ height: 52 }} />
                ) : (
                  <select id="turma" value={turma} onChange={(e) => setTurma(e.target.value)} required>
                    {turmas.length === 0 && <option value="">Nenhuma turma cadastrada</option>}
                    {turmas.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button className="botao-primario" type="submit" disabled={carregando || !turma}>
                {carregando ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <p style={{ fontSize: 13, color: "#778", textAlign: "center", marginTop: 18, marginBottom: 0 }}>
              Não sabe seu RM ou sua turma? Peça ajuda ao seu professor.
            </p>

            <button
              type="button"
              className="botao-secundario"
              style={{ marginTop: 14 }}
              onClick={() => setModoStaff(true)}
            >
              Sou professor ou gestor
            </button>
          </>
        )}

        <BotaoInstalarApp />
      </div>
    </div>
  );
}
