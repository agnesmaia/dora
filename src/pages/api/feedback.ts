import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";
import { atualizarQValue, ModeloQ } from "@/lib/qlearning";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const userId = session.user.id;
  const { estado, acao, resposta, time } = req.body;

  if (!estado || !acao || !resposta) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const qValuesEstado = await prisma.qValue.findMany({
    where: { userId, state: estado },
  });

  const modeloQ: ModeloQ = { [estado]: {} };
  for (const row of qValuesEstado) {
    modeloQ[estado][row.action] = row.qValue;
  }

  const qNovo = atualizarQValue(modeloQ, estado, acao, resposta);
  const qAnterior = modeloQ[estado][acao] ?? 0;

  await prisma.qValue.upsert({
    where: {
      userId_state_action: { userId, state: estado, action: acao },
    },
    update: { qValue: qNovo },
    create: { userId, state: estado, action: acao, qValue: qNovo },
  });

  // Persiste a conclusão por data quando a atividade foi completada
  if (resposta === "completou") {
    const hoje = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
    const chave = time ? `${acao}@${time}` : acao;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { atividadesConcluidas: true },
    });

    const concluidas = (user?.atividadesConcluidas ?? {}) as Record<string, string[]>;
    const doDia = concluidas[hoje] ?? [];

    if (!doDia.includes(chave)) {
      doDia.push(chave);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { atividadesConcluidas: { ...concluidas, [hoje]: doDia } },
    });
  }

  return res.status(200).json({
    qAnterior,
    qNovo,
    diferenca: qNovo - qAnterior,
  });
}
