import { brandColors } from '@activepieces/shared';

function clear() {
  const { style } = document.documentElement;
  brandColors.variableNames().forEach((name) => style.removeProperty(name));
}

export const brandSeed = { clear };
