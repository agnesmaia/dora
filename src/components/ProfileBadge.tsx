"use client";

import { useRouter } from "next/navigation";

const PERFIS_INFO: Record<string, { emoji: string; label: string }> = {
  estudante_matutino: { emoji: "🌅", label: "Estudante Matutino" },
  profissional_noturno: { emoji: "🌙", label: "Profissional Noturno" },
  equilibrado: { emoji: "⚖️", label: "Equilibrado" },
};

interface Props {
  perfil: string;
  nome?: string | null;
}

export default function ProfileBadge({ perfil, nome }: Props) {
  const router = useRouter();
  const info = PERFIS_INFO[perfil] ?? { emoji: "👤", label: perfil };

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-full text-sm font-semibold">
        <span>{info.emoji}</span>
        <span>{nome ?? info.label}</span>
      </div>
      <button
        onClick={() => router.push("/onboarding")}
        className="text-xs text-indigo-500 border border-indigo-300 px-3 py-1.5 rounded-full hover:bg-indigo-50 transition-colors"
      >
        🔄 Trocar perfil
      </button>
    </div>
  );
}
