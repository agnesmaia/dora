import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";
import { ModeloQ } from "@/lib/qlearning";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profile: true },
  });

  if (!user?.profile) {
    return res.status(400).json({ error: "Perfil não definido" });
  }

  const qValues = await prisma.qValue.findMany({
    where: { userId },
  });

  const modeloQ: ModeloQ = {};
  for (const row of qValues) {
    if (!modeloQ[row.state]) modeloQ[row.state] = {};
    modeloQ[row.state][row.action] = row.qValue;
  }

  return res.status(200).json({ modeloQ });
}
