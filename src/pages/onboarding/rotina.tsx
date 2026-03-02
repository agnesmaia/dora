import { useState, useRef } from "react";
import { useRouter } from "next/router";

const TIPOS_ROTINA = [
  { id: "presencial", label: "Trabalho presencial", icon: "work" },
  { id: "home_office", label: "Home office", icon: "home" },
  { id: "hibrido", label: "Híbrido", icon: "coffee" },
  { id: "estudante", label: "Estudante", icon: "school" },
];

const ENERGIA_OPTIONS = [
  { id: "devagar", label: "Devagar", icon: "bedtime" },
  { id: "normal", label: "Normal", icon: "sentiment_satisfied" },
  { id: "energia_alta", label: "Energia alta", icon: "bolt" },
];

interface TimeCardProps {
  label: string;
  dotColor: string;
  value: string;
  onChange: (v: string) => void;
}

function TimeCard({ label, dotColor, value, onChange }: TimeCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    const input = inputRef.current;
    if (!input) return;
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      input.focus();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-[#F0EBE3] text-left"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-xs font-semibold text-[#A08060] tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-bold text-[#2C1810]">{value}</div>
      {/* Hidden input anchored to this button for showPicker() */}
      <input
        ref={inputRef}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </button>
  );
}

export default function RotinaPage() {
  const [acordar, setAcordar] = useState("07:00");
  const [dormir, setDormir] = useState("23:00");
  const [tipoRotina, setTipoRotina] = useState<string | null>(null);
  const [energiaManha, setEnergiaManha] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function continuar() {
    if (!tipoRotina || !energiaManha) return;
    setLoading(true);

    const res = await fetch("/api/onboarding/rotina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acordar, dormir, tipoRotina, energiaManha }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json().catch(() => ({}));
      console.error("[rotina] erro:", res.status, data);
      alert(`Erro ${res.status}: ${data.error ?? "Tente novamente."}`);
      setLoading(false);
    }
  }

  const canContinue = tipoRotina && energiaManha;

  return (
    <main className="min-h-screen bg-[#F5EFE6]">
      <div className="max-w-sm mx-auto min-h-screen flex flex-col px-5 py-6">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-1 bg-[#E8D9C5] rounded-full overflow-hidden">
            <div className="h-full bg-[#7C5C3E] rounded-full w-1/2" />
          </div>
          <span className="text-sm text-[#A08060] font-medium whitespace-nowrap">2 de 4</span>
        </div>

        {/* Clock icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#E8D9C5]">
            <span className="material-symbols-outlined text-[#7C5C3E] text-[32px]" style={{ fontVariationSettings: "'wght' 200" }}>
              schedule
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[#2C1810] text-center mb-2">
          Como é sua rotina?
        </h1>
        <p className="text-sm text-[#7A6050] text-center mb-7">
          Vamos personalizar suas recomendações
        </p>

        {/* Time cards */}
        <div className="flex gap-3 mb-6">
          <TimeCard
            label="ACORDAR"
            dotColor="bg-[#C4A882]"
            value={acordar}
            onChange={setAcordar}
          />
          <TimeCard
            label="DORMIR"
            dotColor="bg-[#7C5C3E]"
            value={dormir}
            onChange={setDormir}
          />
        </div>

        {/* Tipo de Rotina */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-[#2C1810] mb-3">Tipo de Rotina</h2>
          <div className="flex flex-wrap gap-2">
            {TIPOS_ROTINA.map(({ id, label, icon }) => {
              const selected = tipoRotina === id;
              return (
                <button
                  key={id}
                  onClick={() => setTipoRotina(id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all ${
                    selected
                      ? "bg-[#7C5C3E] border-[#7C5C3E] text-white"
                      : "bg-white border-[#E8D9C5] text-[#2C1810] hover:border-[#C4A882]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'wght' 300" }}>
                    {icon}
                  </span>
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Como você se sente pela manhã */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-[#2C1810] mb-3">
            Como você se sente pela manhã?
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {ENERGIA_OPTIONS.map(({ id, label, icon }) => {
              const selected = energiaManha === id;
              return (
                <button
                  key={id}
                  onClick={() => setEnergiaManha(id)}
                  className={`flex flex-col items-center justify-center py-4 rounded-2xl bg-white border-2 transition-all ${
                    selected ? "border-[#7C5C3E]" : "border-transparent"
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[24px] mb-1.5 text-[#7C5C3E]"
                    style={{ fontVariationSettings: "'wght' 300" }}
                  >
                    {icon}
                  </span>
                  <span className="text-xs font-medium text-[#2C1810]">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Continuar button */}
        <div className="mt-auto">
          <button
            onClick={continuar}
            disabled={!canContinue || loading}
            className="w-full py-4 rounded-2xl bg-[#7C5C3E] text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-[#7C5C3E]/20 hover:bg-[#5C3D22] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              "Salvando..."
            ) : (
              <>
                Continuar
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
