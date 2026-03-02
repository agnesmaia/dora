export type ModeloQ = Record<string, Record<string, number>>;

const ALPHA = 0.1;
const GAMMA = 0.9;

export const RECOMPENSAS: Record<string, number> = {
  completou: 10,
  parcialmente: 3,
  rejeitou: -5,
  adiou: -1,
  ignorou: -1,
};

export function buildEstado(dia: number, hora: number, energia: number): string {
  return `(${dia},${hora},${energia})`;
}

export function horaParaBloco(hora: number): number {
  if (hora >= 6 && hora < 12) return 0; // Manhã
  if (hora >= 12 && hora < 18) return 1; // Tarde
  return 2; // Noite
}

export function recomendar(modeloQ: ModeloQ, estado: string, top = 3) {
  const acoes = modeloQ[estado];
  if (!acoes) return [];

  return Object.entries(acoes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, top)
    .map(([acao, qValue]) => ({ acao, qValue }));
}

export function atualizarQValue(
  modeloQ: ModeloQ,
  estado: string,
  acao: string,
  resposta: string
): number {
  const recompensa = RECOMPENSAS[resposta] ?? -1;
  const qAtual = modeloQ[estado]?.[acao] ?? 0;
  const acoes = modeloQ[estado] ?? {};
  const maxQFuturo = Object.values(acoes).length > 0 ? Math.max(...Object.values(acoes)) : 0;

  const qNovo = qAtual + ALPHA * (recompensa + GAMMA * maxQFuturo - qAtual);
  return qNovo;
}

export const ATIVIDADES_MAP: Record<string, string> = {
  trabalho_focado_25min: "💼 Trabalho focado (Pomodoro 25min)",
  reuniao: "👥 Reunião",
  responder_emails: "📧 Responder emails",
  estudar_teoria: "📚 Estudar teoria (2h)",
  fazer_exercicios: "✍️ Fazer exercícios práticos",
  revisar_flashcards: "🎴 Revisar flashcards",
  assistir_aula: "🎓 Assistir aula",
  exercicio_fisico: "🏃 Exercício físico",
  meditacao: "🧘 Meditação (10min)",
  alongamento: "🤸 Alongamento (5min)",
  pausa_cafe: "☕ Pausa para café",
  almoco: "🍽️ Almoço",
  descanso: "😴 Descanso/Soneca",
};

export type Dificuldade = "Fácil" | "Moderado" | "Difícil";

export interface AtividadeMeta {
  nome: string;
  duracao: number;
  dificuldade: Dificuldade;
  corFundo: string;
  icone: string;
}

export const ATIVIDADES_META: Record<string, AtividadeMeta> = {
  trabalho_focado_25min: { nome: "Foco profundo", duracao: 90, dificuldade: "Difícil", corFundo: "bg-purple-100", icone: "📚" },
  reuniao: { nome: "Reunião", duracao: 60, dificuldade: "Moderado", corFundo: "bg-blue-100", icone: "👥" },
  responder_emails: { nome: "Responder emails", duracao: 30, dificuldade: "Fácil", corFundo: "bg-sky-100", icone: "📧" },
  estudar_teoria: { nome: "Estudo aprofundado", duracao: 90, dificuldade: "Difícil", corFundo: "bg-violet-100", icone: "📖" },
  fazer_exercicios: { nome: "Exercícios práticos", duracao: 45, dificuldade: "Moderado", corFundo: "bg-indigo-100", icone: "✍️" },
  revisar_flashcards: { nome: "Flashcards", duracao: 30, dificuldade: "Fácil", corFundo: "bg-emerald-100", icone: "🃏" },
  assistir_aula: { nome: "Assistir aula", duracao: 60, dificuldade: "Moderado", corFundo: "bg-purple-100", icone: "🎓" },
  exercicio_fisico: { nome: "Exercício", duracao: 45, dificuldade: "Moderado", corFundo: "bg-green-100", icone: "🏋️" },
  meditacao: { nome: "Meditação", duracao: 10, dificuldade: "Fácil", corFundo: "bg-teal-100", icone: "🧘" },
  alongamento: { nome: "Alongamento", duracao: 5, dificuldade: "Fácil", corFundo: "bg-yellow-100", icone: "🤸" },
  pausa_cafe: { nome: "Pausa", duracao: 15, dificuldade: "Fácil", corFundo: "bg-blue-100", icone: "☕" },
  almoco: { nome: "Almoço", duracao: 60, dificuldade: "Fácil", corFundo: "bg-orange-100", icone: "🍽️" },
  descanso: { nome: "Descanso", duracao: 30, dificuldade: "Fácil", corFundo: "bg-slate-100", icone: "😴" },
};
