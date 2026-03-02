"use client";

export interface Contexto {
  dia: number;
  hora: number;
  energia: number;
}

interface Props {
  value: Contexto;
  onChange: (ctx: Contexto) => void;
}

export default function ContextSelector({ value, onChange }: Props) {
  function set(field: keyof Contexto, v: number) {
    onChange({ ...value, [field]: v });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          📅 Dia da Semana
        </label>
        <select
          value={value.dia}
          onChange={(e) => set("dia", Number(e.target.value))}
          className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value={0}>Segunda-feira</option>
          <option value={1}>Terça-feira</option>
          <option value={2}>Quarta-feira</option>
          <option value={3}>Quinta-feira</option>
          <option value={4}>Sexta-feira</option>
          <option value={5}>Sábado</option>
          <option value={6}>Domingo</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ⏰ Hora do Dia
        </label>
        <select
          value={value.hora}
          onChange={(e) => set("hora", Number(e.target.value))}
          className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value={0}>Manhã (6h–12h)</option>
          <option value={1}>Tarde (12h–18h)</option>
          <option value={2}>Noite (18h–23h)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ⚡ Nível de Energia
        </label>
        <select
          value={value.energia}
          onChange={(e) => set("energia", Number(e.target.value))}
          className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value={1}>🔋 Muito baixa</option>
          <option value={2}>🔋🔋 Baixa</option>
          <option value={3}>🔋🔋🔋 Média</option>
          <option value={4}>🔋🔋🔋🔋 Alta</option>
          <option value={5}>🔋🔋🔋🔋🔋 Muito alta</option>
        </select>
      </div>
    </div>
  );
}
