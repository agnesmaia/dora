import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildEstado, ATIVIDADES_MAP, ATIVIDADES_META } from "@/lib/qlearning";
import BottomNav from "@/components/BottomNav";

type Ponto = { dia: number; qValue: number };
type RankItem = { posicao: number; acao: string; qValue: number };

interface SimResult {
  progressao: Ponto[];
  progressaoSarsa: Ponto[];
  progressaoBandit: Ponto[];
  rankingInicial: RankItem[];
  rankingFinal: RankItem[];
  qConvergencia: number;
  banditConvergencia: number;
}

const BLOCOS = ["Manhã", "Tarde", "Noite"];
const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const SERIES = [
  { key: "progressao" as const,      label: "Q-Learning", color: "#7C5C3E", dash: ""     },
  { key: "progressaoSarsa" as const, label: "SARSA",      color: "#3B82F6", dash: "5 3"  },
  { key: "progressaoBandit" as const,label: "Bandit",     color: "#10B981", dash: "2 3"  },
];

function estadoLegivel(estado: string) {
  const m = estado.match(/\((\d+),(\d+),(\d+)\)/);
  if (!m) return estado;
  return `${DIAS[Number(m[1])]} · ${BLOCOS[Number(m[2])]} · Energia ${m[3]}`;
}

function nomeAtividade(acao: string) {
  return ATIVIDADES_META[acao]?.nome ?? ATIVIDADES_MAP[acao] ?? acao;
}

function MultiLineChart({
  series,
  convergencias,
}: {
  series: { label: string; color: string; dash: string; data: Ponto[] }[];
  convergencias: { label: string; color: string; value: number }[];
}) {
  const W = 300, H = 165;
  const pL = 44, pR = 8, pT = 18, pB = 32;
  const pw = W - pL - pR;
  const ph = H - pT - pB;

  const allVals = [
    ...series.flatMap((s) => s.data.map((d) => d.qValue)),
    ...convergencias.map((c) => c.value),
  ];
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const margin = (rawMax - rawMin) * 0.12 || 5;
  const minQ = rawMin - margin;
  const maxQ = rawMax + margin;
  const range = maxQ - minQ || 1;

  const n = series[0]?.data.length ?? 1;
  const toX = (i: number) => pL + (n > 1 ? (i / (n - 1)) * pw : pw / 2);
  const toY = (q: number) => pT + ph - ((q - minQ) / range) * ph;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Zero line */}
      {minQ < 0 && maxQ > 0 && (
        <line x1={pL} y1={toY(0)} x2={W - pR} y2={toY(0)} stroke="#d1d5db" strokeWidth={0.5} />
      )}

      {/* Convergence dashed lines */}
      {convergencias.map((c) => (
        <g key={c.label}>
          <line
            x1={pL} y1={toY(c.value)} x2={W - pR} y2={toY(c.value)}
            stroke={c.color} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.4}
          />
        </g>
      ))}

      {/* Series lines */}
      {series.map((s) => {
        const points = s.data.map((d, i) => `${toX(i)},${toY(d.qValue)}`).join(" ");
        return (
          <g key={s.label}>
            <polyline
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dash || undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* End dot */}
            <circle
              cx={toX(n - 1)}
              cy={toY(s.data[n - 1].qValue)}
              r={3.5}
              fill={s.color}
            />
          </g>
        );
      })}

      {/* Axes */}
      <line x1={pL} y1={pT} x2={pL} y2={H - pB} stroke="#e5e7eb" strokeWidth={1} />
      <line x1={pL} y1={H - pB} x2={W - pR} y2={H - pB} stroke="#e5e7eb" strokeWidth={1} />

      {/* X labels */}
      <text x={toX(0)} y={H - pB + 13} fontSize={8} fill="#9ca3af" textAnchor="middle">Hoje</text>
      {n > 2 && (
        <text x={toX(Math.floor((n - 1) / 2))} y={H - pB + 13} fontSize={8} fill="#9ca3af" textAnchor="middle">
          Dia {series[0].data[Math.floor((n - 1) / 2)].dia}
        </text>
      )}
      <text x={toX(n - 1)} y={H - pB + 13} fontSize={8} fill="#9ca3af" textAnchor="middle">
        Dia {series[0].data[n - 1].dia}
      </text>

      {/* Y min/max labels */}
      <text x={pL - 5} y={pT + 4} fontSize={7} fill="#9ca3af" textAnchor="end">{Math.round(maxQ)}</text>
      <text x={pL - 5} y={H - pB} fontSize={7} fill="#9ca3af" textAnchor="end">{Math.round(minQ)}</text>
    </svg>
  );
}

const RESPOSTAS = [
  { id: "completou",    label: "Fez"      },
  { id: "parcialmente", label: "Parcial"  },
  { id: "rejeitou",     label: "Rejeitou" },
] as const;

export default function SimulatePage({ energiaBase }: { energiaBase: number }) {
  const router = useRouter();

  const [estado, setEstado] = useState("");
  const [atividades, setAtividades] = useState<string[]>([]);
  const [selectedAtiv, setSelectedAtiv] = useState("");
  const [resposta, setResposta] = useState<string>("completou");
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<SimResult | null>(null);
  const [loadingModel, setLoadingModel] = useState(true);

  useEffect(() => {
    const now = new Date();
    const dia = (now.getDay() + 6) % 7;
    const hora = now.getHours();
    const bloco = hora >= 6 && hora < 12 ? 0 : hora >= 12 && hora < 18 ? 1 : 2;
    const est = buildEstado(dia, bloco, energiaBase);
    setEstado(est);

    fetch("/api/model")
      .then((r) => r.json())
      .then((data) => {
        const modeloQ = data.modeloQ ?? {};
        const acoes = Object.keys(modeloQ[est] ?? {}).sort(
          (a, b) => (modeloQ[est][b] ?? 0) - (modeloQ[est][a] ?? 0)
        );
        setAtividades(acoes);
        if (acoes.length > 0) setSelectedAtiv(acoes[0]);
      })
      .finally(() => setLoadingModel(false));
  }, [energiaBase]);

  async function simular() {
    if (!selectedAtiv || !estado) return;
    setLoading(true);
    setResultado(null);
    try {
      const params = new URLSearchParams({
        atividade: selectedAtiv,
        estado,
        resposta,
        dias: String(dias),
      });
      const res = await fetch(`/api/simulate?${params}`);
      const data = await res.json();
      setResultado(data);
    } finally {
      setLoading(false);
    }
  }

  const posAntes = resultado?.rankingInicial.find((r) => r.acao === selectedAtiv)?.posicao;
  const posDepois = resultado?.rankingFinal.find((r) => r.acao === selectedAtiv)?.posicao;
  const delta =
    posAntes !== undefined && posDepois !== undefined ? posAntes - posDepois : 0;

  // Build chart series and convergence lines when result is available
  const chartSeries = resultado
    ? SERIES.map((s) => ({
        label: s.label,
        color: s.color,
        dash: s.dash,
        data: resultado[s.key],
      }))
    : [];

  const chartConvergencias = resultado
    ? [
        { label: "Q-Learning / SARSA", color: "#7C5C3E", value: resultado.qConvergencia },
        { label: "Bandit", color: "#10B981", value: resultado.banditConvergencia },
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#FAF7F2] pb-24 md:pb-0 md:pl-56">
      <div className="w-full max-w-2xl mx-auto flex flex-col pb-12">
        {/* Header */}
        <div className="pt-12 px-5 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-[#7C5C3E]"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <h1 className="text-xl font-bold text-[#2C1810]">Comparação de Algoritmos</h1>
          </div>
          <p className="text-sm text-[#A08060] mt-2 ml-8">
            Compare Q-Learning, SARSA e Multi-Armed Bandit com os mesmos episódios e condições.
          </p>
        </div>

        {loadingModel ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#7C5C3E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : atividades.length === 0 ? (
          <div className="mx-5 bg-white rounded-2xl p-6 text-center text-sm text-[#A08060] shadow-sm border border-[#F0EBE3]">
            Sem dados para o estado atual.
            <br />
            Use o app por alguns dias e volte aqui.
          </div>
        ) : (
          <div className="px-5 flex flex-col gap-4">
            {/* State badge */}
            <div className="bg-white/80 rounded-xl px-3 py-2 text-xs text-[#A08060] text-center font-medium border border-[#F0EBE3]">
              Estado atual: {estadoLegivel(estado)}
            </div>

            {/* Controls */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0EBE3] flex flex-col gap-4">
              {/* Activity */}
              <div>
                <label className="text-xs font-semibold text-[#A08060] uppercase tracking-wide">
                  Atividade
                </label>
                <select
                  value={selectedAtiv}
                  onChange={(e) => {
                    setSelectedAtiv(e.target.value);
                    setResultado(null);
                  }}
                  className="mt-1 w-full border border-[#E8D9C5] rounded-xl px-3 py-2 text-sm text-[#2C1810] bg-white focus:outline-none focus:border-[#7C5C3E]"
                >
                  {atividades.map((a) => (
                    <option key={a} value={a}>
                      {ATIVIDADES_MAP[a] ?? a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resposta */}
              <div>
                <label className="text-xs font-semibold text-[#A08060] uppercase tracking-wide">
                  Feedback simulado
                </label>
                <div className="mt-1 flex gap-2">
                  {RESPOSTAS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setResposta(r.id);
                        setResultado(null);
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        resposta === r.id
                          ? "bg-[#7C5C3E] text-white"
                          : "bg-[#FAF7F2] text-[#7A6050] hover:bg-[#F5EFE6]"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dias */}
              <div>
                <label className="text-xs font-semibold text-[#A08060] uppercase tracking-wide">
                  Dias simulados
                </label>
                <div className="mt-1 flex gap-2">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDias(d);
                        setResultado(null);
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        dias === d
                          ? "bg-[#7C5C3E] text-white"
                          : "bg-[#FAF7F2] text-[#7A6050] hover:bg-[#F5EFE6]"
                      }`}
                    >
                      {d} dias
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={simular}
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-[#7C5C3E] text-white font-semibold text-sm hover:bg-[#5C3D22] transition-colors disabled:opacity-60 active:scale-95"
              >
                {loading ? "Simulando..." : "Simular"}
              </button>
            </div>

            {/* Results */}
            {resultado && (
              <>
                {/* Multi-line chart */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0EBE3]">
                  <h2 className="text-sm font-bold text-[#2C1810] mb-0.5">
                    Convergência comparativa
                  </h2>
                  <p className="text-xs text-[#A08060] mb-3">
                    {nomeAtividade(selectedAtiv)} · {dias} dias · feedback &ldquo;{resposta}&rdquo;
                  </p>

                  {/* Legend */}
                  <div className="flex gap-4 mb-3">
                    {SERIES.map((s) => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <svg width={20} height={8}>
                          <line
                            x1={0} y1={4} x2={20} y2={4}
                            stroke={s.color}
                            strokeWidth={2}
                            strokeDasharray={s.dash || undefined}
                          />
                        </svg>
                        <span className="text-xs text-[#7A6050]">{s.label}</span>
                      </div>
                    ))}
                  </div>

                  <MultiLineChart series={chartSeries} convergencias={chartConvergencias} />

                  {/* Stats table */}
                  <div className="mt-3 grid grid-cols-3 text-xs text-center gap-1">
                    {SERIES.map((s) => {
                      const data = resultado[s.key];
                      const qFinal = data[data.length - 1].qValue;
                      return (
                        <div key={s.label}>
                          <p className="font-semibold mb-0.5" style={{ color: s.color }}>
                            {s.label}
                          </p>
                          <p className="text-[#A08060]">
                            {data[0].qValue} → <span className="font-bold" style={{ color: s.color }}>{qFinal}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Algorithm explanation */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0EBE3]">
                  <h2 className="text-sm font-bold text-[#2C1810] mb-3">Como cada algoritmo funciona</h2>
                  <div className="flex flex-col gap-3">
                    {[
                      {
                        color: "#7C5C3E",
                        title: "Q-Learning (off-policy)",
                        desc: "Atualiza com o valor máximo do próximo estado, independente da política seguida. Converge mais rápido mas ignora a exploração.",
                      },
                      {
                        color: "#3B82F6",
                        title: "SARSA (on-policy)",
                        desc: "Atualiza com a ação realmente selecionada via ε-greedy no próximo estado. Mais conservador — considera o custo da exploração.",
                      },
                      {
                        color: "#10B981",
                        title: "Multi-Armed Bandit",
                        desc: "Sem estados nem desconto futuro. Mantém média de recompensa por ação. Converge para a recompensa imediata, não o valor de longo prazo.",
                      },
                    ].map((item) => (
                      <div key={item.title} className="flex gap-3 items-start">
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ background: item.color }}
                        />
                        <div>
                          <p className="text-xs font-semibold text-[#2C1810]">{item.title}</p>
                          <p className="text-xs text-[#A08060] mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ranking comparison (Q-Learning only, unchanged) */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0EBE3]">
                  <h2 className="text-sm font-bold text-[#2C1810] mb-3">
                    Posição no ranking (Q-Learning)
                  </h2>

                  <div
                    className={`mb-4 rounded-xl px-3 py-2.5 text-center text-sm font-semibold ${
                      delta > 0
                        ? "bg-green-50 text-green-700"
                        : delta < 0
                        ? "bg-red-50 text-red-600"
                        : "bg-[#FAF7F2] text-[#7A6050]"
                    }`}
                  >
                    {delta > 0
                      ? `Subiu ${delta} posição${delta > 1 ? "ões" : ""} no ranking`
                      : delta < 0
                      ? `Caiu ${Math.abs(delta)} posição${Math.abs(delta) > 1 ? "ões" : ""} no ranking`
                      : "Manteve a posição no ranking"}
                    {posAntes !== undefined && posDepois !== undefined && (
                      <span className="text-xs font-normal ml-1 opacity-70">
                        (#{posAntes} → #{posDepois})
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(["Antes", "Depois"] as const).map((label) => {
                      const ranking =
                        label === "Antes" ? resultado.rankingInicial : resultado.rankingFinal;
                      return (
                        <div key={label}>
                          <p className="text-xs font-semibold text-[#A08060] mb-2">{label}</p>
                          {ranking.slice(0, 6).map((r) => {
                            const isSelected = r.acao === selectedAtiv;
                            return (
                              <div
                                key={r.acao}
                                className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg mb-1 ${
                                  isSelected
                                    ? "bg-[#F5EFE6] border border-[#E8D9C5]"
                                    : "bg-[#FAF7F2]"
                                }`}
                              >
                                <span className="text-xs text-[#A08060] w-4 shrink-0">
                                  {r.posicao}.
                                </span>
                                <span
                                  className={`text-xs truncate flex-1 ${
                                    isSelected
                                      ? "font-semibold text-[#7C5C3E]"
                                      : "text-[#7A6050]"
                                  }`}
                                >
                                  {nomeAtividade(r.acao)}
                                </span>
                                <span
                                  className={`text-xs shrink-0 ${
                                    isSelected
                                      ? "font-bold text-[#7C5C3E]"
                                      : "text-[#A08060]"
                                  }`}
                                >
                                  {r.qValue}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await auth(context);
  if (!session?.user?.id) return { redirect: { destination: "/", permanent: false } };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { energiaManha: true },
  });

  const ENERGIA_MAP: Record<string, number> = { devagar: 2, normal: 3, energia_alta: 5 };
  const energiaBase = ENERGIA_MAP[(user?.energiaManha as string) ?? "normal"] ?? 3;

  return { props: { energiaBase } };
};
