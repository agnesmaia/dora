import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";
import { buildEstado } from "@/lib/qlearning";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PERFIS_VALIDOS = ["estudante_matutino", "profissional_noturno", "equilibrado"] as const;
const TIPOS_VALIDOS = ["presencial", "home_office", "hibrido", "estudante"] as const;
const ENERGIA_VALIDA = ["devagar", "normal", "energia_alta"] as const;
const DIFICULDADES_VALIDAS = ["Fácil", "Moderado", "Difícil"] as const;
const HORARIOS_VALIDOS = ["manha", "tarde", "noite"] as const;
const DIAS_SEMANA = ["0", "1", "2", "3", "4", "5", "6"] as const; // 0=Seg … 6=Dom

type Perfil = (typeof PERFIS_VALIDOS)[number];
type TipoRotina = (typeof TIPOS_VALIDOS)[number];
type Energia = (typeof ENERGIA_VALIDA)[number];
type Dificuldade = (typeof DIFICULDADES_VALIDAS)[number];
type Horario = (typeof HORARIOS_VALIDOS)[number];

export interface AtividadeCustom {
  id: string;
  nome: string;
  duracao: number;       // minutos
  dificuldade: Dificuldade;
  horarioIdeal: Horario;
  prioridade: number;    // 1–10
  icone: string;         // emoji
}

export interface SlotAgenda {
  horario: string;       // "HH:MM"
  atividade: string;     // id da atividade
}

export type AgendaSemanal = Record<string, SlotAgenda[]>; // "0"…"6"

interface PerfilGPT {
  perfil: Perfil;
  acordarTime: string;
  dormirTime: string;
  tipoRotina: TipoRotina;
  energiaManha: Energia;
  atividades: AtividadeCustom[];
  agendaSemanal: AgendaSemanal;
}

const BLOCO_MAP: Record<Horario, number> = { manha: 0, tarde: 1, noite: 2 };

function inicializarQValues(atividades: AtividadeCustom[]) {
  const rows: { state: string; action: string; qValue: number }[] = [];

  for (let dia = 0; dia <= 6; dia++) {
    for (let bloco = 0; bloco <= 2; bloco++) {
      for (let energia = 1; energia <= 5; energia++) {
        const estado = buildEstado(dia, bloco, energia);
        for (const atividade of atividades) {
          const blocoIdeal = BLOCO_MAP[atividade.horarioIdeal];
          const qValue = blocoIdeal === bloco ? atividade.prioridade * 1.5 : 0.5;
          rows.push({ state: estado, action: atividade.id, qValue });
        }
      }
    }
  }

  return rows;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function sanitizeSlots(raw: unknown, ids: Set<string>): SlotAgenda[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => ids.has(slugify(String(s.atividade))) && /^\d{2}:\d{2}$/.test(s.horario))
    .map((s) => ({ horario: s.horario as string, atividade: slugify(String(s.atividade)) }))
    .sort((a, b) => a.horario.localeCompare(b.horario));
}

const PROMPT_SISTEMA = `Você é um assistente especializado em rotinas pessoais. Analise a rotina descrita e retorne um perfil com atividades COMPLETAMENTE personalizadas e uma agenda SEMANAL que varia por dia.

IMPORTANTE:
- Crie atividades baseadas EXCLUSIVAMENTE no que o usuário descreveu
- NÃO adicione atividades que não foram mencionadas ou claramente implícitas
- A agenda deve ser DIFERENTE nos dias que têm atividades específicas (ex: pilates só na quarta e sexta)

Dias da semana: 0=Segunda, 1=Terça, 2=Quarta, 3=Quinta, 4=Sexta, 5=Sábado, 6=Domingo

Retorne APENAS JSON válido neste formato:
{
  "perfil": "estudante_matutino" | "profissional_noturno" | "equilibrado",
  "acordarTime": "HH:MM",
  "dormirTime": "HH:MM",
  "tipoRotina": "presencial" | "home_office" | "hibrido" | "estudante",
  "energiaManha": "devagar" | "normal" | "energia_alta",
  "atividades": [
    {
      "id": "<snake_case único>",
      "nome": "<nome legível em português>",
      "duracao": <minutos>,
      "dificuldade": "Fácil" | "Moderado" | "Difícil",
      "horarioIdeal": "manha" | "tarde" | "noite",
      "prioridade": <1-10>,
      "icone": "<emoji>"
    }
  ],
  "agendaSemanal": {
    "0": [ { "horario": "HH:MM", "atividade": "<id>" } ],
    "1": [ ... ],
    "2": [ ... ],
    "3": [ ... ],
    "4": [ ... ],
    "5": [ ... ],
    "6": [ ... ]
  }
}

Regras para atividades:
- Máximo de 10 atividades distintas no total
- Nomes em português que o usuário reconheceria
- Duração realista
- Prioridade 10 = central na rotina, 1 = complementar

Regras para agendaSemanal:
- Cada dia deve refletir com precisão o que o usuário descreveu para aquele dia
- Dias com atividades fixas (ex: aula às 6h só na quarta/sexta) devem ter horários distintos
- Dias similares podem ter a mesma estrutura
- Entre 6 e 12 slots por dia
- Use as durações para calcular horários subsequentes
- Ordene cronologicamente`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: "Não autenticado" });

  const { descricao } = req.body;
  if (!descricao || typeof descricao !== "string" || descricao.trim().length < 10) {
    return res.status(400).json({ error: "Descrição muito curta" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: PROMPT_SISTEMA },
        { role: "user", content: `Rotina: "${descricao.trim()}"` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const gpt = JSON.parse(raw) as Partial<PerfilGPT>;

    // Sanitize profile fields
    const perfil: PerfilGPT = {
      perfil: PERFIS_VALIDOS.includes(gpt.perfil as Perfil) ? (gpt.perfil as Perfil) : "equilibrado",
      acordarTime: /^\d{2}:\d{2}$/.test(gpt.acordarTime ?? "") ? gpt.acordarTime! : "07:00",
      dormirTime: /^\d{2}:\d{2}$/.test(gpt.dormirTime ?? "") ? gpt.dormirTime! : "23:00",
      tipoRotina: TIPOS_VALIDOS.includes(gpt.tipoRotina as TipoRotina) ? (gpt.tipoRotina as TipoRotina) : "home_office",
      energiaManha: ENERGIA_VALIDA.includes(gpt.energiaManha as Energia) ? (gpt.energiaManha as Energia) : "normal",
      atividades: (Array.isArray(gpt.atividades) ? gpt.atividades : [])
        .filter(
          (a) =>
            typeof a.nome === "string" &&
            typeof a.duracao === "number" &&
            DIFICULDADES_VALIDAS.includes(a.dificuldade) &&
            HORARIOS_VALIDOS.includes(a.horarioIdeal) &&
            typeof a.prioridade === "number"
        )
        .slice(0, 10)
        .map((a) => ({
          ...a,
          id: a.id ? slugify(String(a.id)) : slugify(a.nome),
          duracao: Math.max(5, Math.min(240, Number(a.duracao))),
          prioridade: Math.max(1, Math.min(10, Number(a.prioridade))),
          icone: typeof a.icone === "string" ? a.icone : "📌",
        })),
      agendaSemanal: {},
    };

    // Validate agendaSemanal: only known IDs and valid times
    const ids = new Set(perfil.atividades.map((a) => a.id));
    const rawSemanal = (gpt.agendaSemanal ?? {}) as Record<string, unknown>;
    for (const dia of DIAS_SEMANA) {
      perfil.agendaSemanal[dia] = sanitizeSlots(rawSemanal[dia], ids);
    }

    // Save user profile + weekly schedule + custom activities
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        profile: perfil.perfil,
        acordarTime: perfil.acordarTime,
        dormirTime: perfil.dormirTime,
        tipoRotina: perfil.tipoRotina,
        energiaManha: perfil.energiaManha,
        agendaSemanal: JSON.parse(JSON.stringify(perfil.agendaSemanal)),
        atividadesCustom: JSON.parse(JSON.stringify(perfil.atividades)),
      },
    });

    // Initialize Q-values from custom activities
    await prisma.qValue.deleteMany({ where: { userId: session.user.id } });
    const rows = inicializarQValues(perfil.atividades);
    await prisma.qValue.createMany({
      data: rows.map((r) => ({ userId: session.user.id, ...r })),
    });

    return res.status(200).json({ ok: true, perfil });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/onboarding/gpt]", msg);
    return res.status(500).json({ error: msg });
  }
}
