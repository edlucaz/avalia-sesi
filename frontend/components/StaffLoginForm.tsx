"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  staffLogin,
  staffSolicitarAcesso,
  staffTrocarSenha,
} from "@/lib/api";
import { salvarSessaoStaff } from "@/lib/session";

type Etapa = "login" | "trocar-senha" | "solicitar" | "solicitado";

export default function StaffLoginForm({ onVoltar }: { onVoltar: () => void }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [tokenTemporario, setTokenTemporario] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaNovaConfirma, setSenhaNovaConfirma] = useState("");
  const [nomeSolicitacao, setNomeSolicitacao] = useState("");
  const [emailSolicitacao, setEmailSolicitacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const resposta = await staffLogin(email.trim().toLowerCase(), senha);
      if (resposta.precisa_trocar_senha) {
        setTokenTemporario(resposta.access_token);
        setEtapa("trocar-senha");
      } else {
        salvarSessaoStaff(resposta.access_token, resposta.funcionario);
        router.push("/professor");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setErro("Seu acesso ainda não foi aprovado. Peça pra um professor ou gestor liberar.");
      } else {
        setErro("E-mail ou senha incorretos.");
      }
    } finally {
      setCarregando(false);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senhaNova.length < 8) {
      setErro("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (senhaNova !== senhaNovaConfirma) {
      setErro("As duas senhas não são iguais.");
      return;
    }
    setCarregando(true);
    try {
      const resposta = await staffTrocarSenha(tokenTemporario, senhaNova);
      salvarSessaoStaff(resposta.access_token, resposta.funcionario);
      router.push("/professor");
    } catch {
      setErro("Não foi possível trocar a senha. Tente entrar de novo.");
    } finally {
      setCarregando(false);
    }
  }

  async function solicitar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await staffSolicitarAcesso(nomeSolicitacao.trim(), emailSolicitacao.trim().toLowerCase());
      setEtapa("solicitado");
    } catch (err) {
      setErro(
        err instanceof ApiError && err.status === 409
          ? "Já existe uma conta ou solicitação com esse e-mail."
          : "Não foi possível enviar a solicitação."
      );
    } finally {
      setCarregando(false);
    }
  }

  if (etapa === "trocar-senha") {
    return (
      <form onSubmit={trocarSenha}>
        <p className="subtitulo">Primeiro acesso: defina sua senha pessoal.</p>
        {erro && <div className="erro">{erro}</div>}
        <div className="campo">
          <label htmlFor="senhaNova">Nova senha</label>
          <input
            id="senhaNova"
            type="password"
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="campo">
          <label htmlFor="senhaNovaConfirma">Confirme a nova senha</label>
          <input
            id="senhaNovaConfirma"
            type="password"
            value={senhaNovaConfirma}
            onChange={(e) => setSenhaNovaConfirma(e.target.value)}
            required
          />
        </div>
        <button className="botao-primario" type="submit" disabled={carregando}>
          {carregando ? "Salvando..." : "Salvar senha e entrar"}
        </button>
      </form>
    );
  }

  if (etapa === "solicitado") {
    return (
      <div>
        <p className="subtitulo">
          Solicitação enviada. Assim que um professor ou gestor já cadastrado aprovar, você recebe
          acesso com a senha padrão da escola.
        </p>
        <button type="button" className="botao-secundario" onClick={() => setEtapa("login")}>
          Voltar pro login
        </button>
      </div>
    );
  }

  if (etapa === "solicitar") {
    return (
      <form onSubmit={solicitar}>
        <p className="subtitulo">Ainda não tem acesso? Peça aqui — um professor ou gestor aprova.</p>
        {erro && <div className="erro">{erro}</div>}
        <div className="campo">
          <label htmlFor="nomeSolicitacao">Seu nome</label>
          <input
            id="nomeSolicitacao"
            value={nomeSolicitacao}
            onChange={(e) => setNomeSolicitacao(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="campo">
          <label htmlFor="emailSolicitacao">E-mail institucional</label>
          <input
            id="emailSolicitacao"
            type="email"
            placeholder="nome.sobrenome@sesisp.org.br"
            value={emailSolicitacao}
            onChange={(e) => setEmailSolicitacao(e.target.value)}
            required
          />
        </div>
        <button className="botao-primario" type="submit" disabled={carregando}>
          {carregando ? "Enviando..." : "Solicitar acesso"}
        </button>
        <button
          type="button"
          className="botao-secundario"
          style={{ marginTop: 10 }}
          onClick={() => setEtapa("login")}
        >
          Voltar pro login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={entrar}>
      <p className="subtitulo">Acesso de professores, coordenação e direção.</p>
      {erro && <div className="erro">{erro}</div>}
      <div className="campo">
        <label htmlFor="emailStaff">E-mail institucional</label>
        <input
          id="emailStaff"
          type="email"
          placeholder="nome.sobrenome@sesisp.org.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="campo">
        <label htmlFor="senhaStaff">Senha</label>
        <input
          id="senhaStaff"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
      </div>
      <button className="botao-primario" type="submit" disabled={carregando}>
        {carregando ? "Entrando..." : "Entrar"}
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
        <button
          type="button"
          className="botao-secundario"
          style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
          onClick={onVoltar}
        >
          ← Sou aluno
        </button>
        <button
          type="button"
          className="botao-secundario"
          style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
          onClick={() => setEtapa("solicitar")}
        >
          Solicitar acesso
        </button>
      </div>
    </form>
  );
}
