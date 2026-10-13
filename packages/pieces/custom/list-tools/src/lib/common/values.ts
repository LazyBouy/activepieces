function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn({ record, key }: { record: Record<string, unknown>; key: string }): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null;
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return isRecord(value) && Object.keys(value).length === 0;
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

function toDate(value: unknown): number | null {
  const asNumber = toNumber(value);
  if (asNumber !== null) {
    return asNumber;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const match = ISO_DATE_TEXT.exec(value.trim());
  if (match === null) {
    return null;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, zoneText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = hourText === undefined ? 0 : Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  const second = secondText === undefined ? 0 : Number(secondText);
  const millisecond = fractionText === undefined ? 0 : Number(`${fractionText}00`.slice(0, 3));
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const date = new Date(Date.UTC(2000, month - 1, day, hour, minute, second, millisecond));
  date.setUTCFullYear(year);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  const offsetMinutes = parseZoneOffset(zoneText);
  if (offsetMinutes === null) {
    return null;
  }
  return date.getTime() - offsetMinutes * 60000;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1 || value === 0) {
    return value === 1;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return null;
}

function toText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function toDisplayText(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  const text = toText(value);
  return text === null ? JSON.stringify(value) : text;
}

function readText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function readFlag({ value, fallback }: { value: unknown; fallback: boolean }): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return fallback;
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function chooseOption<T extends string>({
  value,
  allowed,
  fallback,
  label,
}: {
  value: unknown;
  allowed: readonly T[];
  fallback: T;
  label: string;
}): T {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const found = allowed.find((option) => option === value);
  if (found === undefined) {
    throw new Error(`Choose one of the listed options for "${label}".`);
  }
  return found;
}

function parseZoneOffset(zone: string | undefined): number | null {
  if (zone === undefined || zone.toUpperCase() === 'Z') {
    return 0;
  }
  const match = ZONE_TEXT.exec(zone);
  if (match === null) {
    return null;
  }
  const [, sign, hoursText, minutesText] = match;
  const hours = Number(hoursText);
  const minutes = minutesText === undefined ? 0 : Number(minutesText);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  const total = hours * 60 + minutes;
  return sign === '-' ? -total : total;
}

const NUMBER_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const ISO_DATE_TEXT =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i;
const ZONE_TEXT = /^([+-])(\d{2}):?(\d{2})?$/;

export const values = {
  isRecord,
  hasOwn,
  isMissing,
  isEmpty,
  toNumber,
  toDate,
  toBoolean,
  toText,
  toDisplayText,
  readText,
  readFlag,
  readRecord,
  readRows,
  chooseOption,
};
