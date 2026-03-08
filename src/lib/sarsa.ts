import { ModeloQ, RECOMPENSAS } from "./qlearning";

const ALPHA = 0.1;
const GAMMA = 0.9;
const EPSILON = 0.1;

function selecionarAcaoEGreedy(acoes: Record<string, number>): string {
  const keys = Object.keys(acoes);
  if (keys.length === 0) return "";
  if (Math.random() < EPSILON) {
    return keys[Math.floor(Math.random() * keys.length)];
  }
  return keys.reduce((best, k) => (acoes[k] > acoes[best] ? k : best), keys[0]);
}

/**
 * SARSA (on-policy TD): Q(s,a) ← Q(s,a) + α[r + γ·Q(s',a') − Q(s,a)]
 * where a' é a ação selecionada via ε-greedy no próximo estado (mesmo estado
 * nesta simulação de estado fixo), não o máximo como no Q-Learning.
 */
export function atualizarSarsaValue(
  modeloQ: ModeloQ,
  estado: string,
  acao: string,
  resposta: string
): number {
  const recompensa = RECOMPENSAS[resposta] ?? -1;
  const qAtual = modeloQ[estado]?.[acao] ?? 0;
  const acoes = modeloQ[estado] ?? {};

  // On-policy: próxima ação escolhida por ε-greedy (não max)
  const proximaAcao = selecionarAcaoEGreedy(acoes);
  const qProxima = proximaAcao ? (acoes[proximaAcao] ?? 0) : 0;

  return qAtual + ALPHA * (recompensa + GAMMA * qProxima - qAtual);
}
