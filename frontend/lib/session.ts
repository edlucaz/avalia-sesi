"use client";

import { Aluno, Funcionario } from "./api";

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

// --- Sessão de funcionário (professor/coordenação/direção) ---
const STAFF_TOKEN_KEY = "avalia-sesi:staff-token";
const STAFF_FUNCIONARIO_KEY = "avalia-sesi:staff-funcionario";

export function salvarSessaoStaff(token: string, funcionario: Funcionario) {
  localStorage.setItem(STAFF_TOKEN_KEY, token);
  localStorage.setItem(STAFF_FUNCIONARIO_KEY, JSON.stringify(funcionario));
}

export function lerSessaoStaff(): { token: string; funcionario: Funcionario } | null {
  const token = localStorage.getItem(STAFF_TOKEN_KEY);
  const funcionarioRaw = localStorage.getItem(STAFF_FUNCIONARIO_KEY);
  if (!token || !funcionarioRaw) return null;
  try {
    return { token, funcionario: JSON.parse(funcionarioRaw) as Funcionario };
  } catch {
    return null;
  }
}

export function limparSessaoStaff() {
  localStorage.removeItem(STAFF_TOKEN_KEY);
  localStorage.removeItem(STAFF_FUNCIONARIO_KEY);
}
