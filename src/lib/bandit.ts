import { RECOMPENSAS } from "./qlearning";

const ALPHA = 0.1;
const EPSILON = 0.1;

/** Mapa de ação → valor estimado (sem estados) */
export type ModeloBandit = Record<string, number>;

/**
 * Multi-Armed Bandit ε-greedy.
 * Não usa estados nem desconto — mantém apenas um valor médio por ação.
 * Q(a) ← Q(a) + α[r − Q(a)]
 */
export function atualizarBanditValue(
  modelo: ModeloBandit,
  acao: string,
  resposta: string
): number {
  const recompensa = RECOMPENSAS[resposta] ?? -1;
  const qAtual = modelo[acao] ?? 0;
  return qAtual + ALPHA * (recompensa - qAtual);
}

export function selecionarAcaoBandit(modelo: ModeloBandit): string {
  const keys = Object.keys(modelo);
  if (keys.length === 0) return "";
  if (Math.random() < EPSILON) {
    return keys[Math.floor(Math.random() * keys.length)];
  }
  return keys.reduce((best, k) => (modelo[k] > modelo[best] ? k : best), keys[0]);
}
