"use client";

import { ATIVIDADES_MAP } from "@/lib/qlearning";

export interface Recomendacao {
  acao: string;
  qValue: number;
}

interface Props {
  recomendacao: Recomendacao;
  index: number;
  estado: string;
  onFeedback: (index: number, qNovo: number) => void;
  feedbackDado: boolean;
}

function confidenceLabel(qValue: number) {
  if (qValue > 50) return { label: "Alta", className: "bg-green-100 text-green-800" };
  if (qValue > 20) return { label: "Média", className: "bg-yellow-100 text-yellow-800" };
  return { label: "Baixa", className: "bg-red-100 text-red-800" };
}

export default function SuggestionCard({ recomendacao, index, estado, onFeedback, feedbackDado }: Props) {
  const { acao, qValue } = recomendacao;
  const nomeAmigavel = ATIVIDADES_MAP[acao] ?? acao;
  const conf = confidenceLabel(qValue);

  async function darFeedback(resposta: string) {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, acao, resposta }),
    });

    if (res.ok) {
      const { qNovo } = await res.json();
      onFeedback(index, qNovo);
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-indigo-400">
      <div className="mb-3">
        <div className="font-semibold text-gray-800 mb-1">{nomeAmigavel}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Q-value: {qValue.toFixed(2)}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${conf.className}`}>
            {conf.label}
          </span>
        </div>
      </div>

      {!feedbackDado ? (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => darFeedback("completou")}
            className="px-3 py-1.5 bg-green-100 text-green-800 text-xs font-medium rounded-lg hover:bg-green-200 transition-colors"
          >
            ✅ Fiz isso!
          </button>
          <button
            onClick={() => darFeedback("parcialmente")}
            className="px-3 py-1.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-lg hover:bg-yellow-200 transition-colors"
          >
            🟡 Fiz parcialmente
          </button>
          <button
            onClick={() => darFeedback("rejeitou")}
            className="px-3 py-1.5 bg-red-100 text-red-800 text-xs font-medium rounded-lg hover:bg-red-200 transition-colors"
          >
            ❌ Não quis fazer
          </button>
        </div>
      ) : (
        <p className="text-xs text-green-600 font-semibold">✔ Feedback registrado!</p>
      )}
    </div>
  );
}
