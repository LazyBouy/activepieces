function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!NUMBER_TEXT.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function readWholeNumber({ value, label, min }: { value: unknown; label: string; min: number }): number | null {
  if (isBlank(value)) {
    return null;
  }
  const parsed = toNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${label} must be a whole number of ${min} or more.`);
  }
  return parsed;
}

function readSeconds({ value, label }: { value: unknown; label: string }): number {
  if (isBlank(value)) {
    return 0;
  }
  const parsed = toNumber(value);
  if (parsed === null || parsed < 0) {
    throw new Error(`${label} must be a number of 0 or more.`);
  }
  return parsed;
}

function readFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

function readJsonObject({ value, label }: { value: unknown; label: string }): Record<string, unknown> {
  if (isBlank(value)) {
    return {};
  }
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  if (!isRecord(parsed)) {
    throw new Error(`${label} must be a JSON object, for example {"role": "admin"}.`);
  }
  return parsed;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function secondsToIso(seconds: unknown): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return null;
  }
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const NUMBER_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

export const values = {
  isRecord,
  readText,
  isBlank,
  toNumber,
  readWholeNumber,
  readSeconds,
  readFlag,
  readJsonObject,
  parseJson,
  secondsToIso,
};
