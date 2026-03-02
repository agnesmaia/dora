import fs from "fs";
import path from "path";
import { ModeloQ, horaParaBloco, RECOMPENSAS } from "./qlearning";

const DATASETS_DIR = path.join(process.cwd(), "data", "datasets");

export function carregarDataset(perfil: string): ModeloQ {
  const filename = `dataset_${perfil}.csv`;
  const filepath = path.join(DATASETS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Dataset não encontrado para perfil: ${perfil}`);
  }

  const csv = fs.readFileSync(filepath, "utf-8");
  return parseCSV(csv);
}

function parseCSV(csv: string): ModeloQ {
  const lines = csv.split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());

  const idxDiaSemana = headers.indexOf("dia_semana");
  const idxHora = headers.indexOf("hora");
  const idxEnergia = headers.indexOf("energia");
  const idxAtividade = headers.indexOf("atividade");
  const idxResposta = headers.indexOf("resposta");

  const modeloQ: ModeloQ = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",").map((v) => v.trim());
    if (values.length < 4) continue;

    const diaSemana = values[idxDiaSemana];
    const hora = parseInt(values[idxHora]);
    const energia = values[idxEnergia];
    const atividade = values[idxAtividade];
    const resposta = values[idxResposta];

    if (!diaSemana || isNaN(hora) || !energia || !atividade) continue;

    const blocoHorario = horaParaBloco(hora);
    const estado = `(${diaSemana},${blocoHorario},${energia})`;

    if (!modeloQ[estado]) modeloQ[estado] = {};
    if (!modeloQ[estado][atividade]) modeloQ[estado][atividade] = 0;

    const recompensa = RECOMPENSAS[resposta] ?? -1;
    modeloQ[estado][atividade] += recompensa;
  }

  return modeloQ;
}
