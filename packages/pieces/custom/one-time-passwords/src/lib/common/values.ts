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

function chooseOption<T extends string | number>({
  value,
  allowed,
  fallback,
  message,
}: {
  value: unknown;
  allowed: readonly T[];
  fallback: T;
  message: string;
}): T {
  if (isBlank(value)) {
    return fallback;
  }
  const asNumber = typeof value === 'string' ? toNumber(value) : null;
  const found = allowed.find((option) => option === value || (asNumber !== null && option === asNumber));
  if (found === undefined) {
    throw new Error(message);
  }
  return found;
}

function readWholeNumber({
  value,
  fallback,
  min,
  message,
}: {
  value: unknown;
  fallback: number;
  min: number;
  message: string;
}): number {
  if (isBlank(value)) {
    return fallback;
  }
  const parsed = toNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < min) {
    throw new Error(message);
  }
  return parsed;
}

const NUMBER_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

export const values = {
  isBlank,
  toNumber,
  chooseOption,
  readWholeNumber,
};
