import { pathUtils } from '@/lib/path-utils';

function escapeMentionKey(key: string): string {
  return key.replaceAll(/[\\"'\n\r\t’]/g, (char) => `\\${char}`);
}

function propertyPathStarter(stepName: string): string {
  return `${stepName}['output']`;
}

function appendSegmentsToPropertyPath({
  basePath,
  segments,
}: {
  basePath: string;
  segments: (string | number)[];
}): string {
  return segments.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`;
    }
    return `${acc}['${escapeMentionKey(segment)}']`;
  }, basePath);
}

function appendValuePathToPropertyPath(
  basePath: string,
  valuePath: string,
): string {
  return appendSegmentsToPropertyPath({
    basePath,
    segments: pathUtils.parsePath(valuePath),
  });
}

function convertValuePathToPropertyPath(
  stepName: string,
  valuePath: string,
): string {
  return appendValuePathToPropertyPath(
    propertyPathStarter(stepName),
    valuePath,
  );
}

export const pathHelpers = {
  escapeMentionKey,
  appendSegmentsToPropertyPath,
  appendValuePathToPropertyPath,
  convertValuePathToPropertyPath,
  propertyPathStarter,
};
