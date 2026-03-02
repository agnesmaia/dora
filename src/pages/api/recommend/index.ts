import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";
import { buildEstado, recomendar, ModeloQ } from "@/lib/qlearning";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const { dia, hora, energia } = req.body;
  const estado = buildEstado(Number(dia), Number(hora), Number(energia));

  const qValues = await prisma.qValue.findMany({
    where: { userId: session.user.id, state: estado },
  });

  if (qValues.length === 0) {
    return res.status(200).json({ recomendacoes: [], estado });
  }

  const modeloQ: ModeloQ = { [estado]: {} };
  for (const row of qValues) {
    modeloQ[estado][row.action] = row.qValue;
  }

  const recomendacoes = recomendar(modeloQ, estado, 10);
  return res.status(200).json({ recomendacoes, estado });
}
