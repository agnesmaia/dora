import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";
import type { AtividadeCustom } from "@/pages/api/onboarding/gpt";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agendaSemanal: true, atividadesCustom: true },
  });

  const rawSemanal = (user?.agendaSemanal ?? {}) as Record<
    string,
    Array<{ horario: string; atividade: string }>
  >;
  const atividadesCustom = (user?.atividadesCustom ?? []) as unknown as AtividadeCustom[];

  const schedule: Record<
    number,
    Array<{ time: string; acao: string; qValue: number; estado: string }>
  > = {};

  for (let dia = 0; dia < 7; dia++) {
    const slots = rawSemanal[String(dia)] ?? [];
    schedule[dia] = slots.map((slot) => ({
      time: slot.horario,
      acao: slot.atividade,
      qValue: 5,
      estado: "",
    }));
  }

  return res.status(200).json({
    schedule,
    atividadesCustom,
    stats: { concluidas: 0, adesao: 0, streak: 0 },
  });
}
