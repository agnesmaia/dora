import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ─── Constantes do grid ────────────────────────────────────────────────────────
const GRID_START_HOUR = 6; // 06:00
const GRID_END_HOUR = 22; // 22:00
const PIXELS_PER_HOUR = 40;
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * PIXELS_PER_HOUR; // 640px

const DIA_LETRA = ["S", "T", "Q", "Q", "S", "S", "D"];

const MESES_PT = [
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

// Labels de hora a cada 2h (sem o último para não vazar fora do grid)
const TIME_LABELS: string[] = [];
for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h += 2) {
  TIME_LABELS.push(`${String(h).padStart(2, "0")}:00`);
}

// Paleta de cores pasteis para atividades
const COLOR_PALETTE = [
  "bg-rose-300",
  "bg-sky-300",
  "bg-emerald-300",
  "bg-amber-300",
  "bg-violet-300",
  "bg-teal-300",
  "bg-orange-300",
  "bg-indigo-300",
  "bg-pink-300",
  "bg-lime-300",
];

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface ScheduledActivity {
  time: string;
  acao: string;
  qValue: number;
  estado: string;
}

interface AtividadeCustom {
  id: string;
  nome: string;
  duracao: number;
  icone: string;
}

interface WeeklyData {
  schedule: Record<number, ScheduledActivity[]>;
  atividadesCustom: AtividadeCustom[];
  stats: { concluidas: number; adesao: number; streak: number };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function timeToTop(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMin = h * 60 + m;
  const gridStartMin = GRID_START_HOUR * 60;
  return Math.max(0, ((totalMin - gridStartMin) / 60) * PIXELS_PER_HOUR);
}

function durationToHeight(durationMin: number): number {
  return Math.max((durationMin / 60) * PIXELS_PER_HOUR, 16);
}

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isDateToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isDateFuture(date: Date): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date > now;
}

// ─── Componente ────────────────────────────────────────────────────────────────
export default function SemanaView() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/weekly");
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Rola para mostrar o início da manhã após carregar
  useEffect(() => {
    if (!loading && gridRef.current) {
      gridRef.current.scrollTop = PIXELS_PER_HOUR; // mostra a partir de 07:00
    }
  }, [loading]);

  const weekDates = getWeekDates(weekOffset);
  const firstDate = weekDates[0];
  const lastDate = weekDates[6];

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const weekLabel = `${cap(MESES_PT[firstDate.getMonth()])} ${firstDate.getDate()} — ${cap(MESES_PT[lastDate.getMonth()])} ${lastDate.getDate()}`;

  const schedule = data?.schedule ?? {};
  const stats = data?.stats ?? { concluidas: 0, adesao: 0, streak: 0 };
  const atividadesCustom = data?.atividadesCustom ?? [];
  const colorMap: Record<string, string> = Object.fromEntries(
    atividadesCustom.map((a, i) => [
      a.id,
      COLOR_PALETTE[i % COLOR_PALETTE.length],
    ]),
  );

  return (
    <div className="w-full max-w-5xl mx-auto min-h-screen flex flex-col bg-[#FAF7F2]">
      {/* ── Header ── */}
      <div className="pt-12 px-5 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#2C1810]">Minha Semana</h1>
        <div className="w-10 h-10 rounded-full border border-[#E8D9C5] bg-white flex items-center justify-center">
          <span
            className="material-symbols-outlined text-[#7C5C3E] text-[20px]"
            style={{ fontVariationSettings: "'wght' 300" }}
          >
            person
          </span>
        </div>
      </div>

      {/* ── Navegação de semana ── */}
      <div className="mx-5 mb-4 bg-white rounded-2xl flex items-center justify-between px-4 py-3 shadow-sm border border-[#F0EBE3]">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="text-[#A08060] hover:text-[#7C5C3E] transition-colors w-7 h-7 flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[20px]">
            chevron_left
          </span>
        </button>
        <span className="font-semibold text-[#2C1810] text-sm">
          {weekLabel}
        </span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="text-[#A08060] hover:text-[#7C5C3E] transition-colors w-7 h-7 flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[20px]">
            chevron_right
          </span>
        </button>
      </div>

      {/* ── Stats chips ── */}
      <div className="flex gap-2 px-5 mb-4 overflow-x-auto">
        <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shrink-0 shadow-sm border border-[#F0EBE3]">
          <span className="material-symbols-outlined text-[#7C5C3E] text-[14px]">
            check_circle
          </span>
          <span className="text-xs font-semibold text-[#2C1810]">
            {stats.concluidas} concluídas
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shrink-0 shadow-sm border border-[#F0EBE3]">
          <span className="material-symbols-outlined text-[#7C5C3E] text-[14px]">
            bolt
          </span>
          <span className="text-xs font-semibold text-[#2C1810]">
            {stats.adesao}% adesão
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shrink-0 shadow-sm border border-[#F0EBE3]">
          <span className="material-symbols-outlined text-[#7C5C3E] text-[14px]">
            local_fire_department
          </span>
          <span className="text-xs font-semibold text-[#2C1810]">
            {stats.streak} d
          </span>
        </div>
      </div>

      {/* ── Calendário ── */}
      <div className="mx-3 bg-white rounded-3xl shadow-sm border border-[#F0EBE3] flex-1 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#7C5C3E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div
            ref={gridRef}
            className="overflow-auto flex-1"
            style={{ maxHeight: "480px" }}
          >
            {/* Cabeçalho com dias — sticky para acompanhar scroll vertical */}
            <div
              className="flex border-b border-[#F0EBE3] pt-3 pb-2 px-1 sticky top-0 bg-white z-10"
              style={{ minWidth: `${36 + 7 * 80}px` }}
            >
              <div className="w-9 shrink-0" />
              {weekDates.map((date, i) => {
                const today = isDateToday(date);
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-0.5"
                    style={{ width: "80px", minWidth: "80px" }}
                  >
                    <span className="text-[10px] text-[#A08060] font-medium">
                      {DIA_LETRA[i]}
                    </span>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        today ? "bg-[#7C5C3E] text-white" : "text-[#7A6050]"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grid de tempo */}
            <div
              className="flex relative"
              style={{
                height: `${GRID_HEIGHT}px`,
                minWidth: `${36 + 7 * 80}px`,
              }}
            >
              {/* Coluna de labels de hora */}
              <div className="w-9 shrink-0 relative">
                {TIME_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className="absolute right-1 text-[9px] text-[#A08060] leading-none"
                    style={{ top: `${i * 2 * PIXELS_PER_HOUR}px` }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Colunas dos dias */}
              {weekDates.map((date, dayIndex) => {
                const activities = schedule[dayIndex] ?? [];
                const today = isDateToday(date);
                const future = !today && isDateFuture(date);

                return (
                  <div
                    key={dayIndex}
                    className={`relative border-l border-[#F0EBE3] overflow-hidden ${
                      today ? "bg-[#FAF7F2]" : ""
                    }`}
                    style={{ width: "80px", minWidth: "80px" }}
                  >
                    {/* Linhas horizontais de referência */}
                    {TIME_LABELS.map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-[#F0EBE3]"
                        style={{ top: `${i * 2 * PIXELS_PER_HOUR}px` }}
                      />
                    ))}

                    {/* Blocos de atividades geradas pela IA */}
                    {activities.map((activity) => {
                      const meta = atividadesCustom.find(
                        (a) => a.id === activity.acao,
                      );
                      if (!meta) return null;
                      const top = timeToTop(activity.time);
                      const height = durationToHeight(meta.duracao);
                      const colorClass =
                        colorMap[activity.acao] ?? "bg-rose-300";

                      // Opacidade baseada no dia: hoje=100%, futuro=50%, passado=25%
                      const opacityClass = today
                        ? "opacity-100"
                        : future
                          ? "opacity-50"
                          : "opacity-25";

                      return (
                        <div
                          key={`${activity.acao}-${activity.time}`}
                          className={`absolute left-0.5 right-0.5 rounded-md overflow-hidden ${colorClass} ${opacityClass}`}
                          style={{ top: `${top}px`, height: `${height}px` }}
                          title={`${meta.nome} – ${activity.time}`}
                        >
                          {height >= 20 && (
                            <p className="text-[#2C1810]/70 text-[9px] font-semibold px-1 pt-0.5 leading-tight truncate">
                              {meta.icone} {meta.nome}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Link para o dashboard diário ── */}
      <div className="px-5 py-4 text-center">
        <Link
          href="/dashboard"
          className="text-sm text-[#7C5C3E] font-semibold hover:underline"
        >
          Ver recomendações de hoje →
        </Link>
      </div>
    </div>
  );
}
