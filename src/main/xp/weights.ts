import weights from './model-weights.json';

interface ModelWeightEntry {
  readonly name: string;
  readonly index: number;
  readonly weight: number;
}

interface ModelWeightsData {
  readonly referenceIndex: number;
  readonly gamma: number;
  readonly unknownWeight: number;
  readonly models: readonly ModelWeightEntry[];
  readonly mapping: Readonly<Record<string, string>>;
}

const data: ModelWeightsData = weights;

const lowerModelNames = new Map<string, ModelWeightEntry>();
for (const entry of data.models) {
  lowerModelNames.set(entry.name.toLowerCase().trim(), entry);
}

const lowerMapping = new Map<string, string>();
for (const [logName, tableName] of Object.entries(data.mapping)) {
  lowerMapping.set(logName.toLowerCase().trim(), tableName.toLowerCase().trim());
}

export function weightForModel(logModelName: string | undefined): number {
  const normalized = (logModelName ?? '').toLowerCase().trim();
  if (!normalized) return data.unknownWeight;

  const mapped = lowerMapping.get(normalized);
  if (mapped) {
    const entry = lowerModelNames.get(mapped);
    if (entry) return entry.weight;
  }

  const direct = lowerModelNames.get(normalized);
  if (direct) return direct.weight;

  return data.unknownWeight;
}
