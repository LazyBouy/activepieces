import { githubDarkInit, githubLightInit } from '@uiw/codemirror-theme-github';

const neutralSurface = {
  settings: {
    background: 'transparent',
    gutterBackground: 'transparent',
    lineHighlight: 'var(--gray-2)',
  },
};

const codeMirrorDark = githubDarkInit(neutralSurface);
const codeMirrorLight = githubLightInit(neutralSurface);

const codeMirror = (resolvedTheme: string) =>
  resolvedTheme === 'dark' ? codeMirrorDark : codeMirrorLight;

const jsonView = (resolvedTheme: string) =>
  resolvedTheme === 'dark' ? 'bright' : 'rjv-default';

export const syntaxTheme = {
  codeMirror,
  jsonView,
  shiki: { light: 'github-light', dark: 'github-dark' },
};
