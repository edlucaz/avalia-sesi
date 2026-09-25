const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// As imagens das questões exigem login (mesmo material oficial do Avalia+ SESI-SP,
// sem redistribuição autorizada) — por isso vão por querystring, já que uma tag
// <img> não consegue mandar um header Authorization.
export function urlImagemQuestao(questaoId: number, token: string): string {
  return `${API_URL}/api/questoes/${questaoId}/imagem?token=${encodeURIComponent(token)}`;
}

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
  ultima_tentativa_id: number | null;
  ultima_nota: number | null;
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
  tem_imagem?: boolean;
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
  descritor?: string | null;
  enunciado: string;
  alternativas: Record<string, string>;
  gabarito: string;
  alternativa_marcada: string | null;
  acerto: boolean;
  tem_imagem?: boolean;
  comentario_pedagogico?: string | null;
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

export function buscarPainelProfessor(token: string, simuladoId: number, turma: string) {
  return request<PainelSimulado>(
    `/api/professor/simulados/${simuladoId}/painel?turma=${encodeURIComponent(turma)}`,
    { token }
  );
}

// --- Acesso de professores/gestores (funcionários) ---
export interface Funcionario {
  id: number;
  nome: string;
  email: string;
  papel: "professor" | "coordenacao" | "direcao";
}

export interface StaffLoginResponse {
  access_token: string;
  precisa_trocar_senha: boolean;
  funcionario: Funcionario;
}

export function staffLogin(email: string, senha: string) {
  return request<StaffLoginResponse>("/api/staff/login", {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });
}

export function staffTrocarSenha(tokenTemporario: string, senhaNova: string) {
  return request<StaffLoginResponse>("/api/staff/trocar-senha", {
    method: "POST",
    token: tokenTemporario,
    body: JSON.stringify({ senha_nova: senhaNova }),
  });
}

export function staffMe(token: string) {
  return request<Funcionario>("/api/staff/me", { token });
}

export function staffSolicitarAcesso(nome: string, email: string) {
  return request<{ detail: string }>("/api/staff/solicitar-acesso", {
    method: "POST",
    body: JSON.stringify({ nome, email }),
  });
}

export interface SolicitacaoAcesso {
  id: number;
  nome: string;
  email: string;
  status: string;
  criado_em: string;
}

export function listarSolicitacoes(token: string) {
  return request<SolicitacaoAcesso[]>("/api/staff/solicitacoes", { token });
}

export function aprovarSolicitacao(token: string, id: number) {
  return request<SolicitacaoAcesso>(`/api/staff/solicitacoes/${id}/aprovar`, {
    method: "POST",
    token,
  });
}

export function recusarSolicitacao(token: string, id: number) {
  return request<SolicitacaoAcesso>(`/api/staff/solicitacoes/${id}/recusar`, {
    method: "POST",
    token,
  });
}

// --- Modo treino ---
export interface QuestaoTreino {
  questao_id: number;
  disciplina: string;
  enunciado: string;
  alternativas: Record<string, string>;
  tem_imagem?: boolean;
}

export interface ResultadoTreino {
  questao_id: number;
  gabarito: string;
  alternativa_marcada: string;
  acerto: boolean;
  descritor?: string | null;
  comentario_pedagogico?: string | null;
}

export function proximaQuestaoTreino(token: string, disciplina?: string) {
  const qs = disciplina ? `?disciplina=${encodeURIComponent(disciplina)}` : "";
  return request<QuestaoTreino>(`/api/pratica/proxima${qs}`, { token });
}

export function responderTreino(token: string, questaoId: number, alternativaMarcada: string) {
  return request<ResultadoTreino>("/api/pratica/responder", {
    method: "POST",
    token,
    body: JSON.stringify({ questao_id: questaoId, alternativa_marcada: alternativaMarcada }),
  });
}

// --- Professor: criar/listar simulados ---
export interface TurmaOut {
  nome: string;
  etapa: number;
}

export interface SimuladoCriado {
  id: number;
  titulo: string;
  turmas: string[];
  janela_inicio: string;
  janela_fim: string;
  modo_sorteio: string;
  qtd_matematica: number | null;
  qtd_portugues: number | null;
}

export interface SimuladoCriarRequest {
  titulo: string;
  etapa: number;
  trimestre?: number;
  tempo_limite_min?: number;
  dias_disponivel?: number;
  turmas: string[];
  qtd_matematica?: number;
  qtd_portugues?: number;
  modo_sorteio?: string;
}

export function listarTurmasProfessor(token: string) {
  return request<TurmaOut[]>("/api/professor/turmas", { token });
}

export function listarSimuladosProfessor(token: string) {
  return request<SimuladoCriado[]>("/api/professor/simulados", { token });
}

export function criarSimuladoProfessor(token: string, payload: SimuladoCriarRequest) {
  return request<SimuladoCriado>("/api/professor/simulados", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}
