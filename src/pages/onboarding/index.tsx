import { useState } from "react";
import { useRouter } from "next/router";

const PERFIS = [
  {
    id: "estudante_matutino",
    icon: "wb_sunny",
    titulo: "Estudante Matutino",
    descricao:
      "Você estuda pela manhã e tem energia alta nas primeiras horas do dia.",
  },
  {
    id: "profissional_noturno",
    icon: "nights_stay",
    titulo: "Profissional Noturno",
    descricao:
      "Você é mais produtivo à noite e trabalha em horários alternativos.",
  },
  {
    id: "equilibrado",
    icon: "balance",
    titulo: "Equilibrado",
    descricao: "Você distribui trabalho, estudo e bem-estar ao longo do dia.",
  },
];

export default function Onboarding() {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function confirmar() {
    if (!selecionado) return;
    setLoading(true);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perfil: selecionado }),
    });

    if (res.ok) {
      router.push("/onboarding/rotina");
    } else {
      alert("Erro ao salvar perfil. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F5EFE6] flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E8D9C5] p-8 max-w-lg w-full">
        <h1 className="text-2xl font-bold text-[#2C1810] mb-2 text-center">
          Qual é o seu perfil?
        </h1>
        <p className="text-[#7A6050] text-sm text-center mb-8">
          Isso define o dataset inicial do seu assistente
        </p>

        <div className="space-y-3">
          {PERFIS.map((perfil) => (
            <button
              key={perfil.id}
              onClick={() => setSelecionado(perfil.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selecionado === perfil.id
                  ? "border-[#7C5C3E] bg-[#F5EFE6]"
                  : "border-[#E8D9C5] hover:border-[#C4A882]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="material-symbols-outlined text-[24px] text-[#7C5C3E] shrink-0 mt-0.5"
                  style={{ fontVariationSettings: "'wght' 300" }}
                >
                  {perfil.icon}
                </span>
                <div>
                  <div className="font-semibold text-[#2C1810]">
                    {perfil.titulo}
                  </div>
                  <div className="text-sm text-[#7A6050] mt-1">
                    {perfil.descricao}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={confirmar}
          disabled={!selecionado || loading}
          className="mt-6 w-full py-3 bg-[#7C5C3E] text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#5C3D22] transition-colors"
        >
          {loading ? "Salvando..." : "Começar"}
        </button>
      </div>
    </main>
  );
}
