import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { ATIVIDADES_META } from "@/lib/qlearning";
import type { AtividadeCustom } from "@/pages/api/onboarding/gpt";

interface AtividadeAgendada {
  time: string;
  estado: string;
  acao: string;
  qValue: number;
}

interface MetaAtividade {
  nome: string;
  duracao: number;
  dificuldade: "Fácil" | "Moderado" | "Difícil";
  corFundo: string;
  icone: string;
}

interface Props {
  userName?: string | null;
  atividadesCustom?: AtividadeCustom[] | null;
}

const DIAS_SEMANA = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function getDataFormatada() {
  const now = new Date();
  const dia = (now.getDay() + 6) % 7;
  const diaMes = now.getDate();
  const mes = MESES[now.getMonth()];
  return `${DIAS_SEMANA[dia]}, ${diaMes} de ${mes}`;
}

const DIFICULDADE_STYLE: Record<string, string> = {
  Difícil: "text-red-500",
  Moderado: "text-amber-600",
  Fácil: "text-green-600",
};

const DIFICULDADE_COR: Record<string, string> = {
  Fácil: "bg-[#F0EBE3]",
  Moderado: "bg-[#EDE6DB]",
  Difícil: "bg-[#E8DDD1]",
};

function parseEstado(estado: string): {
  dia: number;
  hora: number;
  energia: number;
} {
  const match = estado.match(/\((\d+),(\d+),(\d+)\)/);
  if (!match) return { dia: 0, hora: 0, energia: 3 };
  return {
    dia: Number(match[1]),
    hora: Number(match[2]),
    energia: Number(match[3]),
  };
}

function buildMetaMap(
  atividadesCustom: AtividadeCustom[] | null | undefined,
): Record<string, MetaAtividade> {
  if (atividadesCustom && atividadesCustom.length > 0) {
    return Object.fromEntries(
      atividadesCustom.map((a) => [
        a.id,
        {
          nome: a.nome,
          duracao: a.duracao,
          dificuldade: a.dificuldade as "Fácil" | "Moderado" | "Difícil",
          corFundo: DIFICULDADE_COR[a.dificuldade] ?? "bg-[#F0EBE3]",
          icone: a.icone,
        },
      ]),
    );
  }
  // fallback para usuários antigos com catálogo fixo
  return ATIVIDADES_META as Record<string, MetaAtividade>;
}

export default function DashboardView({ userName, atividadesCustom }: Props) {
  const router = useRouter();
  const [atividades, setAtividades] = useState<AtividadeAgendada[]>([]);
  const [dica, setDica] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<number, boolean>>({});
  const [ajustando, setAjustando] = useState<Record<number, boolean>>({});
  const [alternativas, setAlternativas] = useState<
    Record<number, AtividadeAgendada[]>
  >({});
  const [loadingAlts, setLoadingAlts] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const metaMap = buildMetaMap(atividadesCustom);

  useEffect(() => {
    async function init() {
      try {
        await fetch("/api/model");
        const res = await fetch("/api/recommend/daily");
        if (!res.ok) throw new Error();
        const data = await res.json();
        const ativs: AtividadeAgendada[] = data.atividades ?? [];
        setAtividades(ativs);
        setDica(data.dica ?? null);

        // Restaura quais atividades já foram concluídas hoje
        const concluidasHoje: string[] = data.concluidasHoje ?? [];
        if (concluidasHoje.length > 0) {
          const restoredFeedbacks: Record<number, boolean> = {};
          ativs.forEach((ativ, i) => {
            const chave = `${ativ.acao}@${ativ.time}`;
            if (concluidasHoje.includes(chave)) {
              restoredFeedbacks[i] = true;
            }
          });
          setFeedbacks(restoredFeedbacks);
        }
      } catch {
        setErro(true);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function marcarFeito(index: number, atividade: AtividadeAgendada) {
    if (feedbacks[index]) return;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: atividade.estado,
        acao: atividade.acao,
        resposta: "completou",
        time: atividade.time,
      }),
    });
    setFeedbacks((prev) => ({ ...prev, [index]: true }));
    setAjustando((prev) => ({ ...prev, [index]: false }));
  }

  async function toggleAjustar(index: number, atividade: AtividadeAgendada) {
    const isOpen = ajustando[index] ?? false;
    setAjustando((prev) => ({ ...prev, [index]: !isOpen }));

    if (!isOpen && !alternativas[index]) {
      setLoadingAlts((prev) => ({ ...prev, [index]: true }));
      const { dia, hora, energia } = parseEstado(atividade.estado);
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dia, hora, energia }),
      });
      const data = await res.json();
      const usedAcoes = new Set(atividades.map((a) => a.acao));
      const alts: AtividadeAgendada[] = (data.recomendacoes ?? [])
        .filter(
          (r: { acao: string }) =>
            r.acao !== atividade.acao && !usedAcoes.has(r.acao),
        )
        .slice(0, 3)
        .map((r: { acao: string; qValue: number }) => ({
          ...atividade,
          acao: r.acao,
          qValue: r.qValue,
        }));
      setAlternativas((prev) => ({ ...prev, [index]: alts }));
      setLoadingAlts((prev) => ({ ...prev, [index]: false }));
    }
  }

  function selecionarAlternativa(index: number, nova: AtividadeAgendada) {
    setAtividades((prev) => prev.map((a, i) => (i === index ? nova : a)));
    setAjustando((prev) => ({ ...prev, [index]: false }));
    setAlternativas((prev) => ({ ...prev, [index]: [] }));
    setFeedbacks((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  const dataFormatada = getDataFormatada();

  return (
    <div className="w-full max-w-2xl mx-auto min-h-screen flex flex-col pb-10 bg-[#FAF7F2]">
      {/* Header */}
      <div className="pt-12 px-5 pb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#7C5C3E] text-2xl leading-none">✦</span>
            <h1 className="text-xl font-bold text-[#2C1810]">
              {userName
                ? `Olá, ${userName.split(" ")[0]}`
                : "Recomendações para hoje"}
            </h1>
          </div>
          <div className="pt-1 flex items-center gap-3">
            <button
              onClick={() => router.push("/onboarding/descricao")}
              className="text-sm text-[#7C5C3E] hover:text-[#5C3D22] transition-colors font-medium"
            >
              Atualizar rotina
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-sm text-[#A08060] hover:text-[#7A6050] transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
        <p className="text-[#A08060] text-sm mt-1 ml-8">{dataFormatada}</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#A08060]">
          <div className="w-8 h-8 border-2 border-[#7C5C3E] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Preparando sua rotina...</p>
        </div>
      )}

      {/* Error */}
      {erro && !loading && (
        <div className="mx-5 bg-red-50 rounded-2xl p-4 text-sm text-red-600 text-center">
          Não foi possível carregar as recomendações. Tente novamente.
        </div>
      )}

      {/* Content */}
      {!loading && !erro && (
        <div className="px-5 flex flex-col gap-5">
          {/* Tip card */}
          {dica && (
            <div className="bg-[#F5EFE6] border border-[#E8D9C5] rounded-2xl p-4 flex gap-3">
              <div className="w-8 h-8 bg-[#E8D9C5] rounded-full flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#7C5C3E] text-[18px]">
                  info
                </span>
              </div>
              <p className="text-sm text-[#2C1810]">
                <strong>Dica:</strong> {dica}
              </p>
            </div>
          )}

          {/* Routine */}
          {atividades.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-[#2C1810]">
                  Rotina Sugerida
                </h2>
                <span className="bg-[#F0EBE3] text-[#7C5C3E] text-sm px-3 py-1 rounded-full font-semibold">
                  {atividades.length} atividades
                </span>
              </div>

              <div className="space-y-3">
                {atividades.map((ativ, i) => {
                  const meta = metaMap[ativ.acao];
                  if (!meta) return null;
                  const done = feedbacks[i] ?? false;
                  return (
                    <div
                      key={i}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0EBE3]"
                    >
                      {/* Time row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#A08060]">
                            {ativ.time}
                          </span>
                          <span
                            className={`text-xs font-semibold ${DIFICULDADE_STYLE[meta.dificuldade]}`}
                          >
                            {meta.dificuldade}
                          </span>
                        </div>
                        <span className="text-sm text-[#A08060]">
                          {meta.duracao} min
                        </span>
                      </div>

                      {/* Activity row */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl ${meta.corFundo} flex items-center justify-center text-lg shrink-0`}
                        >
                          {meta.icone}
                        </div>
                        <span className="flex-1 font-semibold text-[#2C1810] text-base">
                          {meta.nome}
                        </span>
                        <button
                          onClick={() => toggleAjustar(i, ativ)}
                          disabled={done}
                          className={`text-sm mr-1 transition-colors ${
                            ajustando[i]
                              ? "text-[#7C5C3E] font-semibold"
                              : "text-[#A08060] hover:text-[#7C5C3E]"
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          Ajustar
                        </button>
                        <button
                          onClick={() => marcarFeito(i, ativ)}
                          disabled={done}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                            done
                              ? "bg-green-500 text-white"
                              : "bg-[#7C5C3E] text-white hover:bg-[#5C3D22] active:scale-95"
                          }`}
                          aria-label="Marcar como feito"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            check
                          </span>
                        </button>
                      </div>

                      {/* Alternativas panel */}
                      {ajustando[i] && (
                        <div className="mt-3 pt-3 border-t border-[#F0EBE3]">
                          {loadingAlts[i] ? (
                            <p className="text-xs text-[#A08060] text-center py-1">
                              Buscando alternativas...
                            </p>
                          ) : (alternativas[i] ?? []).length === 0 ? (
                            <p className="text-xs text-[#A08060] text-center py-1">
                              Sem alternativas disponíveis para este horário.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <p className="text-xs text-[#A08060] font-medium">
                                Escolha uma alternativa:
                              </p>
                              {(alternativas[i] ?? []).map((alt) => {
                                const altMeta = metaMap[alt.acao];
                                if (!altMeta) return null;
                                return (
                                  <button
                                    key={alt.acao}
                                    onClick={() =>
                                      selecionarAlternativa(i, alt)
                                    }
                                    className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F5EFE6] hover:border-[#E8D9C5] border border-[#F0EBE3] transition-colors text-left"
                                  >
                                    <div
                                      className={`w-7 h-7 rounded-lg ${altMeta.corFundo} flex items-center justify-center text-sm shrink-0`}
                                    >
                                      {altMeta.icone}
                                    </div>
                                    <span className="text-sm font-medium text-[#2C1810]">
                                      {altMeta.nome}
                                    </span>
                                    <span className="ml-auto text-xs text-[#A08060]">
                                      {altMeta.duracao} min
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-[#A08060] gap-3">
              <span
                className="material-symbols-outlined text-[48px] text-[#C4A882]"
                style={{ fontVariationSettings: "'wght' 200" }}
              >
                smart_toy
              </span>
              <p className="text-sm text-center">
                Ainda não há recomendações para hoje.
                <br />
                Continue usando o app para personalizar sua rotina!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
