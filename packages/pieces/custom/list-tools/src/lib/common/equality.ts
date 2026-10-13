import { values } from './values';

function canonical({ value, options }: { value: unknown; options: EqualityOptions }): string {
  if (value === undefined) {
    return MISSING_TOKEN;
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return canonicalText({ text: value, options });
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? 'NaN' : String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonical({ value: item, options })).join(',')}]`;
  }
  if (values.isRecord(value)) {
    const record = value;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical({ value: record[key], options })}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function areEqual({ first, second, options }: { first: unknown; second: unknown; options: EqualityOptions }): boolean {
  return canonical({ value: first, options }) === canonical({ value: second, options });
}

function canonicalText({ text, options }: { text: string; options: EqualityOptions }): string {
  if (options.numbersAsText) {
    const asNumber = values.toNumber(text);
    if (asNumber !== null) {
      return String(asNumber);
    }
  }
  return JSON.stringify(options.caseSensitive ? text : text.toLowerCase());
}

const MISSING_TOKEN = '~';

const EXACT: EqualityOptions = { caseSensitive: true, numbersAsText: false };

export const equality = {
  canonical,
  areEqual,
  MISSING_TOKEN,
  EXACT,
};

export type EqualityOptions = {
  caseSensitive: boolean;
  numbersAsText: boolean;
};
