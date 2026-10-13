function baseName(name: unknown): string {
  if (typeof name !== 'string') {
    return '';
  }
  const segments = name.split(/[\\/]/);
  return (segments[segments.length - 1] ?? '').trim();
}

function readGivenName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasGzExtension(name: string): boolean {
  return name.toLowerCase().endsWith(GZ_EXTENSION);
}

function compressedName({ given, inputName }: { given: unknown; inputName: unknown }): string {
  const givenName = readGivenName(given);
  if (givenName !== '') {
    return hasGzExtension(givenName) ? givenName : `${givenName}${GZ_EXTENSION}`;
  }
  const input = baseName(inputName);
  return `${input === '' ? FALLBACK_NAME : input}${GZ_EXTENSION}`;
}

function decompressedName({
  given,
  storedName,
  inputName,
}: {
  given: unknown;
  storedName: string | null;
  inputName: unknown;
}): string {
  const givenName = readGivenName(given);
  if (givenName !== '') {
    return givenName;
  }
  const stored = baseName(storedName);
  if (stored !== '') {
    return stored;
  }
  const input = baseName(inputName);
  const withoutGz = hasGzExtension(input) ? input.slice(0, -GZ_EXTENSION.length) : input;
  return withoutGz === '' ? FALLBACK_NAME : withoutGz;
}

const GZ_EXTENSION = '.gz';

const FALLBACK_NAME = 'file';

export const names = {
  baseName,
  compressedName,
  decompressedName,
};
