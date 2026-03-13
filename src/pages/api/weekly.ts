import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";
import type { AtividadeCustom } from "@/pages/api/onboarding/gpt";
import { buildEstado, recomendar, ModeloQ } from "@/lib/qlearning";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agendaSemanal: true, atividadesCustom: true, energiaManha: true },
  });

  const rawSemanal = (user?.agendaSemanal ?? {}) as Record<
    string,
    Array<{ horario: string; atividade: string }>
  >;
  const atividadesCustom = (user?.atividadesCustom ?? []) as unknown as AtividadeCustom[];

  const ENERGIA_MAP: Record<string, number> = { devagar: 2, normal: 3, energia_alta: 5 };
  const energiaBase = ENERGIA_MAP[user?.energiaManha ?? "normal"] ?? 3;

  const qValues = await prisma.qValue.findMany({ where: { userId: session.user.id } });
  const modeloQ: ModeloQ = {};
  for (const row of qValues) {
    if (!modeloQ[row.state]) modeloQ[row.state] = {};
    modeloQ[row.state][row.action] = row.qValue;
  }

  function horaParaBloco(hora: number): number {
    if (hora >= 6 && hora < 12) return 0;
    if (hora >= 12 && hora < 18) return 1;
    return 2;
  }

  const schedule: Record<
    number,
    Array<{ time: string; acao: string; qValue: number; estado: string }>
  > = {};

  for (let dia = 0; dia < 7; dia++) {
    const slots = rawSemanal[String(dia)] ?? [];
    const usedActions = new Set<string>();

    schedule[dia] = slots.map((slot) => {
      const [hh] = slot.horario.split(":").map(Number);
      const blocoHora = horaParaBloco(hh);
      const estado = buildEstado(dia, blocoHora, energiaBase);

      const recs = recomendar(modeloQ, estado, 20);
      const melhor = recs.find((r) => !usedActions.has(r.acao));
      const acoFinal = melhor ? melhor.acao : slot.atividade;
      const qValue = modeloQ[estado]?.[acoFinal] ?? 0;

      usedActions.add(acoFinal);
      return { time: slot.horario, acao: acoFinal, qValue, estado };
    });
  }

  return res.status(200).json({
    schedule,
    atividadesCustom,
    stats: { concluidas: 0, adesao: 0, streak: 0 },
  });
}
