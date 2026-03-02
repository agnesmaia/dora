import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";

const PERFIS_VALIDOS = ["estudante_matutino", "profissional_noturno", "equilibrado"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const { perfil } = req.body;

  if (!PERFIS_VALIDOS.includes(perfil)) {
    return res.status(400).json({ error: "Perfil inválido" });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { profile: perfil },
  });

  return res.status(200).json({ ok: true });
}
