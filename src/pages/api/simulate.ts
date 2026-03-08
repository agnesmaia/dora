import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";
import { atualizarQValue, ModeloQ } from "@/lib/qlearning";
import { atualizarSarsaValue } from "@/lib/sarsa";
import { atualizarBanditValue, ModeloBandit } from "@/lib/bandit";

// Convergência teórica: r / (1 - γ) aproximado, usado como referência no gráfico
const Q_CONVERGENCIA: Record<string, number> = {
  completou: 100,
  parcialmente: 30,
  rejeitou: -50,
  adiou: -10,
  ignorou: -10,
};

// MAB converge para a recompensa imediata (sem desconto)
const BANDIT_CONVERGENCIA: Record<string, number> = {
  completou: 10,
  parcialmente: 3,
  rejeitou: -5,
  adiou: -1,
  ignorou: -1,
};

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: "Não autenticado" });

  const { atividade, estado, resposta = "completou", dias = "30" } = req.query as Record<string, string>;
  const numDias = Math.min(Math.max(parseInt(dias) || 30, 1), 60);

  if (!atividade || !estado) {
    return res.status(400).json({ error: "atividade e estado são obrigatórios" });
  }

  const rows = await prisma.qValue.findMany({
    where: { userId: session.user.id, state: estado },
  });

  // --- Q-Learning ---
  const modeloQ: ModeloQ = { [estado]: {} };
  for (const row of rows) {
    modeloQ[estado][row.action] = row.qValue;
  }

  const rankingInicial = Object.entries(modeloQ[estado])
    .sort(([, a], [, b]) => b - a)
    .map(([acao, q], i) => ({ posicao: i + 1, acao, qValue: r2(q) }));

  const progressao: Array<{ dia: number; qValue: number }> = [
    { dia: 0, qValue: r2(modeloQ[estado][atividade] ?? 0) },
  ];
  for (let dia = 1; dia <= numDias; dia++) {
    const qNovo = atualizarQValue(modeloQ, estado, atividade, resposta);
    modeloQ[estado][atividade] = qNovo;
    progressao.push({ dia, qValue: r2(qNovo) });
  }

  const rankingFinal = Object.entries(modeloQ[estado])
    .sort(([, a], [, b]) => b - a)
    .map(([acao, q], i) => ({ posicao: i + 1, acao, qValue: r2(q) }));

  // --- SARSA ---
  const modeloSarsa: ModeloQ = { [estado]: {} };
  for (const row of rows) {
    modeloSarsa[estado][row.action] = row.qValue;
  }

  const progressaoSarsa: Array<{ dia: number; qValue: number }> = [
    { dia: 0, qValue: r2(modeloSarsa[estado][atividade] ?? 0) },
  ];
  for (let dia = 1; dia <= numDias; dia++) {
    const qNovo = atualizarSarsaValue(modeloSarsa, estado, atividade, resposta);
    modeloSarsa[estado][atividade] = qNovo;
    progressaoSarsa.push({ dia, qValue: r2(qNovo) });
  }

  // --- Multi-Armed Bandit ---
  const modeloBandit: ModeloBandit = {};
  for (const row of rows) {
    modeloBandit[row.action] = row.qValue;
  }

  const progressaoBandit: Array<{ dia: number; qValue: number }> = [
    { dia: 0, qValue: r2(modeloBandit[atividade] ?? 0) },
  ];
  for (let dia = 1; dia <= numDias; dia++) {
    const qNovo = atualizarBanditValue(modeloBandit, atividade, resposta);
    modeloBandit[atividade] = qNovo;
    progressaoBandit.push({ dia, qValue: r2(qNovo) });
  }

  return res.status(200).json({
    progressao,
    progressaoSarsa,
    progressaoBandit,
    rankingInicial,
    rankingFinal,
    qConvergencia: Q_CONVERGENCIA[resposta] ?? -10,
    banditConvergencia: BANDIT_CONVERGENCIA[resposta] ?? -1,
  });
}
