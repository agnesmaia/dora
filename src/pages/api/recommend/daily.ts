import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";
import { buildEstado, recomendar, ModeloQ } from "@/lib/qlearning";
import type { AtividadeCustom, SlotAgenda, AgendaSemanal } from "@/pages/api/onboarding/gpt";

const ENERGIA_MAP: Record<string, number> = {
  devagar: 2,
  normal: 3,
  energia_alta: 5,
};

function horaParaBloco(hora: number): number {
  if (hora >= 6 && hora < 12) return 0;
  if (hora >= 12 && hora < 18) return 1;
  return 2;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMin: number): string {
  const clamped = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Slot = { time: string; acao: string; qValue: number; estado: string };
type AgendaCache = { date: string; slots: Slot[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: "Não autenticado" });

  // ── PATCH: atualiza um slot no cache quando o usuário troca por alternativa ──
  if (req.method === "PATCH") {
    const { slotIndex, acao, estado, qValue } = req.body;
    if (typeof slotIndex !== "number" || !acao || !estado) {
      return res.status(400).json({ error: "Dados inválidos" });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { agendaHojeCache: true },
    });
    const hoje = new Date().toISOString().split("T")[0];
    const cache = user?.agendaHojeCache as AgendaCache | null;
    if (!cache || cache.date !== hoje) return res.status(409).json({ error: "Cache desatualizado" });

    const slots = [...cache.slots];
    if (slotIndex >= 0 && slotIndex < slots.length) {
      slots[slotIndex] = { ...slots[slotIndex], acao, estado, qValue };
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { agendaHojeCache: { date: hoje, slots } },
    });
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "GET") return res.status(405).end();

  try {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      acordarTime: true,
      dormirTime: true,
      energiaManha: true,
      agendaSemanal: true,
      agendaDiaria: true,
      atividadesCustom: true,
      atividadesConcluidas: true,
      agendaHojeCache: true,
    },
  });


  const hoje = new Date().toISOString().split("T")[0];
  const todasConcluidas = (user?.atividadesConcluidas ?? {}) as Record<string, string[]>;
  const concluidasHoje: string[] = todasConcluidas[hoje] ?? [];

  // ── Serve o cache se existe para hoje (garante horários estáveis durante o dia) ──
  const cache = user?.agendaHojeCache as AgendaCache | null;
  if (cache?.date === hoje && Array.isArray(cache.slots) && cache.slots.length > 0) {
    return res.status(200).json({ atividades: cache.slots, dica: null, concluidasHoje });
  }

  const energiaBase = ENERGIA_MAP[user?.energiaManha ?? "normal"] ?? 3;
  const now = new Date();
  const dia = (now.getDay() + 6) % 7;

  const qValues = await prisma.qValue.findMany({ where: { userId: session.user.id } });
  const modeloQ: ModeloQ = {};
  for (const row of qValues) {
    if (!modeloQ[row.state]) modeloQ[row.state] = {};
    modeloQ[row.state][row.action] = row.qValue;
  }

  const agendaSemanal = user?.agendaSemanal as AgendaSemanal | null;
  const slotsDoDia: SlotAgenda[] | null =
    agendaSemanal && typeof agendaSemanal === "object"
      ? (agendaSemanal[String(dia)] ?? null)
      : null;

  const agendaDiariaLegada = !slotsDoDia
    ? (user?.agendaDiaria as SlotAgenda[] | null)
    : null;

  const slotsParaUsar =
    slotsDoDia && slotsDoDia.length > 0
      ? slotsDoDia
      : agendaDiariaLegada && agendaDiariaLegada.length > 0
      ? agendaDiariaLegada
      : null;

  let atividades: Slot[];
  let dica: string | null = null;

  if (slotsParaUsar) {
    const usedActions = new Set<string>();
    atividades = slotsParaUsar.map(({ horario, atividade }) => {
      const [hh] = horario.split(":").map(Number);
      const blocoHora = horaParaBloco(hh);
      const estado = buildEstado(dia, blocoHora, energiaBase);
      const recs = recomendar(modeloQ, estado, 20);
      const melhor = recs.find((r) => !usedActions.has(r.acao));
      const acoFinal = melhor ? melhor.acao : atividade;
      const qValue = modeloQ[estado]?.[acoFinal] ?? 0;
      usedActions.add(acoFinal);
      return { time: horario, estado, acao: acoFinal, qValue };
    });
  } else {
    // ── Fallback: geração dinâmica (usuários sem agendaSemanal) ──
    const acordarTime = user?.acordarTime ?? "07:00";
    const dormirTime = user?.dormirTime ?? "23:00";
    const acordarMin = timeToMinutes(acordarTime);
    const dormirMin = timeToMinutes(dormirTime);
    const totalWakeMin =
      dormirMin > acordarMin ? dormirMin - acordarMin : 24 * 60 - acordarMin + dormirMin;
    const NUM_SLOTS = 8;
    const segmentSize = Math.floor(totalWakeMin / NUM_SLOTS);
    const energiaDeltas = [0, 0, -1, -1, -2, -2, -2, -3];

    const slotsMapped = energiaDeltas.map((energiaDelta, idx) => {
      const offsetMin = Math.floor(segmentSize * (idx + 0.5));
      const time = minutesToTime(acordarMin + offsetMin);
      const [hh] = time.split(":").map(Number);
      const blocoHora = horaParaBloco(hh);
      const energia = Math.max(energiaBase + energiaDelta, 1);
      return { time, blocoHora, energia, estado: buildEstado(dia, blocoHora, energia) };
    });

    const estados = [...new Set(slotsMapped.map((s) => s.estado))];
    const qValuesSlots = qValues.filter((q) => estados.includes(q.state));
    const modeloQSlots: ModeloQ = {};
    for (const row of qValuesSlots) {
      if (!modeloQSlots[row.state]) modeloQSlots[row.state] = {};
      modeloQSlots[row.state][row.action] = row.qValue;
    }

    const usedActions = new Set<string>();
    atividades = slotsMapped
      .map(({ time, estado }) => {
        const recs = recomendar(modeloQSlots, estado, 10);
        const rec = recs.find((r) => !usedActions.has(r.acao)) ?? recs[0];
        if (rec) usedActions.add(rec.acao);
        return rec ? { time, estado, acao: rec.acao, qValue: rec.qValue } : null;
      })
      .filter((s): s is Slot => s !== null);

    const morningQs = qValues.filter((q) => q.state.includes(",0,")).map((q) => q.qValue);
    const afternoonQs = qValues.filter((q) => q.state.includes(",1,")).map((q) => q.qValue);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    if (morningQs.length >= 3 && afternoonQs.length >= 3) {
      if (avg(afternoonQs) < avg(morningQs) * 0.8) {
        dica = "Detectamos que você tem menor adesão à tarde. Sugerimos reorganizar suas tarefas pesadas para a manhã.";
      } else if (avg(morningQs) < avg(afternoonQs) * 0.8) {
        dica = "Seu rendimento tende a melhorar à tarde. Considere reservar tarefas mais exigentes para esse período.";
      }
    }
  }

  // Persiste o schedule do dia — reloads servem sempre o mesmo horário
  await prisma.user.update({
    where: { id: session.user.id },
    data: { agendaHojeCache: { date: hoje, slots: atividades } },
  });

  return res.status(200).json({ atividades, dica, concluidasHoje });
  } catch (err) {
    console.error("[daily] GET error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}

export function buildAtividadesMeta(atividadesCustom: AtividadeCustom[] | null) {
  if (!atividadesCustom || atividadesCustom.length === 0) return null;
  const DIFICULDADE_COR: Record<string, string> = {
    Fácil: "bg-green-100",
    Moderado: "bg-blue-100",
    Difícil: "bg-purple-100",
  };
  return Object.fromEntries(
    atividadesCustom.map((a) => [
      a.id,
      {
        nome: a.nome,
        duracao: a.duracao,
        dificuldade: a.dificuldade as "Fácil" | "Moderado" | "Difícil",
        corFundo: DIFICULDADE_COR[a.dificuldade] ?? "bg-gray-100",
        icone: a.icone,
      },
    ])
  );
}

export type { AtividadeCustom };
