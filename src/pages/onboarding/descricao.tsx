import { useState } from "react";
import { useRouter } from "next/router";

const EXEMPLOS = [
  "Acordo às 7h, faço exercício antes do trabalho, trabalho das 9h às 18h em home office e estudo inglês à noite.",
  "Sou estudante, acordo às 8h, tenho aulas de manhã e à tarde, estudo para provas à noite e durmo às 24h.",
  "Trabalho presencial das 8h às 17h, vou à academia três vezes por semana à noite e durmo às 22h.",
];

export default function DescricaoPage() {
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  async function analisar() {
    if (descricao.trim().length < 20) {
      setErro("Descreva um pouco mais sobre a sua rotina.");
      return;
    }
    setLoading(true);
    setErro(null);

    try {
      const res = await fetch("/api/onboarding/gpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao }),
      });

      if (res.ok) {
        router.push("/dashboard");
      } else {
        const data = await res.json().catch(() => ({}));
        setErro(data.error ?? "Erro ao analisar sua rotina. Tente novamente.");
        setLoading(false);
      }
    } catch {
      setErro("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F5EFE6]">
      <div className="max-w-sm mx-auto min-h-screen flex flex-col px-5 py-6">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-1 bg-[#E8D9C5] rounded-full overflow-hidden">
            <div className="h-full bg-[#7C5C3E] rounded-full w-full" />
          </div>
          <span className="text-sm text-[#A08060] font-medium whitespace-nowrap">1 de 1</span>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#E8D9C5]">
            <span className="material-symbols-outlined text-[#7C5C3E] text-[32px]" style={{ fontVariationSettings: "'wght' 200" }}>
              auto_awesome
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[#2C1810] text-center mb-2">
          Como é o seu dia a dia?
        </h1>
        <p className="text-sm text-[#7A6050] text-center mb-7">
          Descreva sua rotina com suas palavras. Nossa IA vai personalizar as recomendações para você.
        </p>

        {/* Textarea */}
        <textarea
          value={descricao}
          onChange={(e) => {
            setDescricao(e.target.value);
            if (erro) setErro(null);
          }}
          placeholder="Ex: Acordo às 7h, faço exercício antes do trabalho, trabalho das 9h às 18h em home office..."
          rows={6}
          className="w-full rounded-2xl border border-[#E8D9C5] bg-white p-4 text-sm text-[#2C1810] placeholder-[#C4A882] focus:outline-none focus:border-[#7C5C3E] resize-none transition-colors"
        />

        {/* Examples */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-[#A08060] mb-2">Clique para usar um exemplo:</p>
          <div className="space-y-2">
            {EXEMPLOS.map((ex, i) => (
              <button
                key={i}
                onClick={() => setDescricao(ex)}
                className="w-full text-left text-xs text-[#7C5C3E] bg-white rounded-xl px-3 py-2.5 border border-[#E8D9C5] hover:border-[#C4A882] transition-colors leading-relaxed"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {erro && (
          <p className="mt-4 text-sm text-red-500 text-center">{erro}</p>
        )}

        {/* Submit */}
        <div className="mt-auto pt-6">
          {loading && (
            <p className="text-xs text-[#A08060] text-center mb-3">
              Isso pode levar alguns segundos...
            </p>
          )}
          <button
            onClick={analisar}
            disabled={descricao.trim().length < 20 || loading}
            className="w-full py-4 rounded-2xl bg-[#7C5C3E] text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-[#7C5C3E]/20 hover:bg-[#5C3D22] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analisando com IA...
              </>
            ) : (
              <>
                Personalizar minha rotina
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
