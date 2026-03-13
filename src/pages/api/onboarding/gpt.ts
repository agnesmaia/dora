import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/db";
import { buildEstado } from "@/lib/qlearning";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PERFIS_VALIDOS = [
  "estudante_matutino",
  "profissional_noturno",
  "equilibrado",
] as const;
const TIPOS_VALIDOS = [
  "presencial",
  "home_office",
  "hibrido",
  "estudante",
] as const;
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
  duracao: number; // minutos
  dificuldade: Dificuldade;
  horarioIdeal: Horario;
  prioridade: number; // 1–10
  icone: string; // emoji
}

export interface SlotAgenda {
  horario: string; // "HH:MM"
  atividade: string; // id da atividade
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
          const qValue =
            blocoIdeal === bloco ? atividade.prioridade * 1.5 : 0.5;
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
    .filter(
      (s) =>
        ids.has(slugify(String(s.atividade))) &&
        /^\d{2}:\d{2}$/.test(s.horario),
    )
    .map((s) => ({
      horario: s.horario as string,
      atividade: slugify(String(s.atividade)),
    }))
    .sort((a, b) => a.horario.localeCompare(b.horario));
}

const PROMPT_SISTEMA = `
Você é um assistente especializado em rotinas pessoais e formação de hábitos. Seu papel é analisar a descrição livre do usuário e gerar um perfil comportamental completo com atividades personalizadas e uma agenda semanal detalhada.

Seu output será usado para inicializar os Q-Values de um sistema de Aprendizado por Reforço — portanto a agenda deve refletir com precisão o comportamento real descrito, não uma rotina ideal genérica.

O usuário descreveu sua rotina em linguagem natural durante o onboarding:

"{{USER_INPUT}}"

Extraia desse texto:
- Horários mencionados explicitamente
- Dias com atividades fixas
- Atividades recorrentes vs. ocasionais
- O objetivo principal declarado (se houver)
- O perfil de energia ao longo do dia

Gere APENAS um objeto JSON válido, sem texto antes ou depois, sem markdown.

Estrutura obrigatória:
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
- Máximo de 10 atividades distintas
- Crie atividades baseadas EXCLUSIVAMENTE no que o usuário descreveu
- NÃO adicione atividades não mencionadas ou claramente implícitas
- Nomes em português que o usuário reconheceria
- Duração realista
- Prioridade 10 = central na rotina, 1 = complementar

Regras para agendaSemanal:
- Cada dia deve refletir com precisão o que o usuário descreveu para aquele dia
- Dias com atividades fixas devem ter horários distintos dos demais
- Entre 6 e 12 slots por dia
- Use as durações para calcular horários subsequentes
- Ordene cronologicamente

---

EXEMPLO:

Entrada:
"Acordo às 8h, trabalho das 10h às 18h. Terça e quinta faço corrida às 7h antes do trabalho. Objetivo: manter a corrida na rotina."

Saída:
{
  "perfil": "equilibrado",
  "acordarTime": "08:00",
  "dormirTime": "23:00",
  "tipoRotina": "presencial",
  "energiaManha": "normal",
  "atividades": [
    {
      "id": "corrida",
      "nome": "Corrida",
      "duracao": 45,
      "dificuldade": "Moderado",
      "horarioIdeal": "manha",
      "prioridade": 9,
      "icone": "🏃"
    },
    {
      "id": "cafe_manha",
      "nome": "Café da manhã",
      "duracao": 20,
      "dificuldade": "Fácil",
      "horarioIdeal": "manha",
      "prioridade": 7,
      "icone": "☕"
    },
    {
      "id": "trabalho",
      "nome": "Trabalho",
      "duracao": 480,
      "dificuldade": "Moderado",
      "horarioIdeal": "manha",
      "prioridade": 10,
      "icone": "💼"
    }
  ],
  "agendaSemanal": {
    "0": [
      { "horario": "08:00", "atividade": "cafe_manha" },
      { "horario": "10:00", "atividade": "trabalho" }
    ],
    "1": [
      { "horario": "07:00", "atividade": "corrida" },
      { "horario": "08:00", "atividade": "cafe_manha" },
      { "horario": "10:00", "atividade": "trabalho" }
    ],
    "2": [
      { "horario": "08:00", "atividade": "cafe_manha" },
      { "horario": "10:00", "atividade": "trabalho" }
    ],
    "3": [
      { "horario": "07:00", "atividade": "corrida" },
      { "horario": "08:00", "atividade": "cafe_manha" },
      { "horario": "10:00", "atividade": "trabalho" }
    ],
    "4": [
      { "horario": "08:00", "atividade": "cafe_manha" },
      { "horario": "10:00", "atividade": "trabalho" }
    ],
    "5": [],
    "6": []
  }
}

---

Agora processe a entrada real do usuário e retorne apenas o JSON.

Antes de gerar o JSON, raciocine internamente seguindo estas 4 etapas:

1. ANÁLISE → Identifique: horários de acordar/dormir, atividades fixas com dia e hora definidos, atividades recorrentes sem dia fixo, o objetivo declarado e o perfil de energia.

2. SELEÇÃO → Classifique cada atividade: dificuldade, horário ideal e prioridade. Atividades físicas intensas antes do trabalho = Difícil/manhã. Atividades criativas ou cognitivas = Moderado/manhã. Lazer e estudo = tarde/noite.

3. CONSTRUÇÃO → Monte a agendaSemanal dia a dia. Comece pelos dias com restrições fixas (ex: pilates só na quarta). Calcule horários subsequentes somando a duração de cada atividade. Garanta que dias similares tenham estrutura coerente.

4. VALIDAÇÃO → Confirme: (a) JSON válido, (b) todos os campos presentes, (c) ids da agendaSemanal existem em atividades, (d) horários em ordem cronológica, (e) objetivo do usuário atendido.

Retorne APENAS o JSON. Nenhum outro texto.

`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getSession(req, res);
  if (!session?.user?.id)
    return res.status(401).json({ error: "Não autenticado" });

  const { descricao } = req.body;
  if (
    !descricao ||
    typeof descricao !== "string" ||
    descricao.trim().length < 10
  ) {
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
      perfil: PERFIS_VALIDOS.includes(gpt.perfil as Perfil)
        ? (gpt.perfil as Perfil)
        : "equilibrado",
      acordarTime: /^\d{2}:\d{2}$/.test(gpt.acordarTime ?? "")
        ? gpt.acordarTime!
        : "07:00",
      dormirTime: /^\d{2}:\d{2}$/.test(gpt.dormirTime ?? "")
        ? gpt.dormirTime!
        : "23:00",
      tipoRotina: TIPOS_VALIDOS.includes(gpt.tipoRotina as TipoRotina)
        ? (gpt.tipoRotina as TipoRotina)
        : "home_office",
      energiaManha: ENERGIA_VALIDA.includes(gpt.energiaManha as Energia)
        ? (gpt.energiaManha as Energia)
        : "normal",
      atividades: (Array.isArray(gpt.atividades) ? gpt.atividades : [])
        .filter(
          (a) =>
            typeof a.nome === "string" &&
            typeof a.duracao === "number" &&
            DIFICULDADES_VALIDAS.includes(a.dificuldade) &&
            HORARIOS_VALIDOS.includes(a.horarioIdeal) &&
            typeof a.prioridade === "number",
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
