const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // resposta sem corpo JSON
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface Aluno {
  id: number;
  rm: string;
  nome: string;
  turma: string;
}

export interface LoginResponse {
  access_token: string;
  aluno: Aluno;
}

export function listarTurmas() {
  return request<string[]>("/api/auth/turmas");
}

export function login(rm: string, turma: string) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ rm, turma }),
  });
}

export interface SimuladoResumo {
  id: number;
  titulo: string;
  disciplinas: string[];
  trimestre: number;
  tempo_limite_min: number;
  janela_inicio: string;
  janela_fim: string;
  ja_respondido: boolean;
}

export function listarSimulados(token: string) {
  return request<SimuladoResumo[]>("/api/simulados", { token });
}

export interface QuestaoProva {
  id: number;
  ordem: number;
  disciplina: string;
  enunciado: string;
  alternativas: Record<string, string>;
}

export interface TentativaIniciada {
  tentativa_id: number;
  tempo_limite_min: number;
  tempo_restante_seg: number;
  questoes: QuestaoProva[];
}

export function iniciarSimulado(token: string, simuladoId: number) {
  return request<TentativaIniciada>(`/api/simulados/${simuladoId}/iniciar`, {
    method: "POST",
    token,
  });
}

export function responder(
  token: string,
  tentativaId: number,
  questaoId: number,
  alternativaMarcada: string | null,
  marcadaParaRevisao: boolean
) {
  return request<{ tempo_restante_seg: number }>(
    `/api/tentativas/${tentativaId}/responder`,
    {
      method: "POST",
      token,
      body: JSON.stringify({
        questao_id: questaoId,
        alternativa_marcada: alternativaMarcada,
        marcada_para_revisao: marcadaParaRevisao,
      }),
    }
  );
}

export function enviarTentativa(token: string, tentativaId: number) {
  return request<{ tentativa_id: number; nota_geral: number }>(
    `/api/tentativas/${tentativaId}/enviar`,
    { method: "POST", token }
  );
}

export interface QuestaoComentada {
  questao_id: number;
  disciplina: string;
  habilidade: string;
  enunciado: string;
  alternativas: Record<string, string>;
  gabarito: string;
  alternativa_marcada: string | null;
  acerto: boolean;
}

export interface DesempenhoHabilidade {
  habilidade: string;
  disciplina: string;
  total: number;
  acertos: number;
  percentual: number;
}

export interface ResultadoTentativa {
  tentativa_id: number;
  simulado_titulo: string;
  nota_geral: number;
  total_questoes: number;
  total_acertos: number;
  desempenho_por_habilidade: DesempenhoHabilidade[];
  questoes: QuestaoComentada[];
}

export function buscarResultado(token: string, tentativaId: number) {
  return request<ResultadoTentativa>(`/api/tentativas/${tentativaId}/resultado`, {
    token,
  });
}

export interface AlunoPainel {
  aluno: string;
  rm: string;
  status: string;
  nota_geral: number | null;
}

export interface PainelSimulado {
  simulado_id: number;
  titulo: string;
  turma: string;
  total_alunos: number;
  total_concluidos: number;
  nota_media: number | null;
  meta_institucional: number | null;
  ranking_habilidades_mais_erradas: DesempenhoHabilidade[];
  alunos: AlunoPainel[];
}

export function buscarPainelProfessor(
  professorToken: string,
  simuladoId: number,
  turma: string
) {
  return request<PainelSimulado>(
    `/api/professor/simulados/${simuladoId}/painel?turma=${encodeURIComponent(turma)}`,
    { headers: { "X-Professor-Token": professorToken } }
  );
}
