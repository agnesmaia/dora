import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";
import { atualizarQValue, ModeloQ } from "@/lib/qlearning";

const Q_CONVERGENCIA: Record<string, number> = {
  completou: 100,
  parcialmente: 30,
  rejeitou: -50,
  adiou: -10,
  ignorou: -10,
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

  return res.status(200).json({
    progressao,
    rankingInicial,
    rankingFinal,
    qConvergencia: Q_CONVERGENCIA[resposta] ?? -10,
  });
}
