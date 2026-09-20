export function corDesempenho(percentual: number): string {
  if (percentual >= 70) return "var(--verde-acerto)";
  if (percentual >= 40) return "var(--sesi-amarelo)";
  return "var(--vermelho-erro)";
}
