import { paths } from './paths';
import { values } from './values';

function render({ template, entry }: { template: string; entry: unknown }): string {
  return template.replace(PLACEHOLDER, (_match: string, path: string) =>
    values.toDisplayText(paths.read({ value: entry, path: paths.parse(path) })),
  );
}

const PLACEHOLDER = /\{([A-Za-z0-9_$À-￿-]+(?:\.[A-Za-z0-9_$À-￿-]+)*)\}/g;

export const templates = {
  render,
};
