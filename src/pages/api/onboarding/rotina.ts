import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";

const TIPOS_VALIDOS = ["presencial", "home_office", "hibrido", "estudante"];
const ENERGIA_VALIDA = ["devagar", "normal", "energia_alta"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const session = await getSession(req, res);
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { acordar, dormir, tipoRotina, energiaManha } = req.body;

    if (!TIPOS_VALIDOS.includes(tipoRotina)) {
      return res.status(400).json({ error: "Tipo de rotina inválido" });
    }

    if (!ENERGIA_VALIDA.includes(energiaManha)) {
      return res.status(400).json({ error: "Energia inválida" });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        acordarTime: acordar,
        dormirTime: dormir,
        tipoRotina,
        energiaManha,
      },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[/api/onboarding/rotina]", err);
    return res.status(500).json({ error: String(err) });
  }
}
