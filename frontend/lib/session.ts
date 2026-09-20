"use client";

import { Aluno } from "./api";

const TOKEN_KEY = "avalia-sesi:token";
const ALUNO_KEY = "avalia-sesi:aluno";

export function salvarSessao(token: string, aluno: Aluno) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ALUNO_KEY, JSON.stringify(aluno));
}

export function lerSessao(): { token: string; aluno: Aluno } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const alunoRaw = localStorage.getItem(ALUNO_KEY);
  if (!token || !alunoRaw) return null;
  try {
    return { token, aluno: JSON.parse(alunoRaw) as Aluno };
  } catch {
    return null;
  }
}

export function limparSessao() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ALUNO_KEY);
}
