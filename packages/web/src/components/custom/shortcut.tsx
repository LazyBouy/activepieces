import { cn } from '@/lib/utils';

const toTitleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const Shortcut = ({
  shortcutKey,
  withCtrl,
  withShift,
  withAlt,
  variant = 'text',
  className,
}: ShortcutProps & { className?: string }) => {
  const isMac = /(Mac)/i.test(navigator.userAgent);
  const isEscape = shortcutKey?.toLocaleLowerCase() === 'esc';

  if (variant === 'keys') {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        {shortcutUtils
          .getKeyLabels({ shortcutKey, withCtrl, withShift, withAlt, isMac })
          .map((label) => (
            <kbd
              key={label}
              className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-xs bg-gray-12/30 px-1 font-sans text-xss font-medium text-gray-12/87"
            >
              {label}
            </kbd>
          ))}
      </span>
    );
  }

  if (variant === 'chip') {
    const keys = [
      !isEscape && withCtrl ? (isMac ? '⌘' : 'Ctrl') : null,
      !isEscape && withShift ? 'Shift' : null,
      !isEscape && withAlt ? (isMac ? '⌥' : 'Alt') : null,
      shortcutKey ? toTitleCase(shortcutKey) : null,
    ].filter((key) => key !== null);
    return (
      <kbd
        className={cn(
          'inline-flex h-5 items-center rounded-sm bg-gray-4 px-1 font-sans text-xs font-medium text-gray-11',
          className,
        )}
      >
        {keys.join(' ')}
      </kbd>
    );
  }

  return (
    <span
      className={cn('grow text-xs tracking-widest text-gray-11', className)}
    >
      {!isEscape && withCtrl && (isMac ? '⌘' : 'Ctrl')}
      {!isEscape && withShift && 'Shift'}
      {!isEscape && withAlt && (isMac ? '⌥' : 'Alt')}
      {!isEscape && (withCtrl || withShift || withAlt) && ' + '}
      {shortcutKey && toTitleCase(shortcutKey)}
    </span>
  );
};

function getKeyLabels({
  shortcutKey,
  withCtrl,
  withShift,
  withAlt,
  isMac,
}: Omit<ShortcutProps, 'variant'> & { isMac: boolean }): string[] {
  const isEscape = ['esc', 'escape'].includes(shortcutKey.toLowerCase());
  if (isEscape) {
    return ['Esc'];
  }
  const modifiers = [
    withCtrl ? (isMac ? '⌘' : 'Ctrl') : null,
    withShift ? '⇧' : null,
    withAlt ? (isMac ? '⌥' : 'Alt') : null,
  ].filter((key) => key !== null);
  return [...modifiers, formatKey(shortcutKey)];
}

function formatKey(shortcutKey: string): string {
  if (shortcutKey === '-') {
    return '−';
  }
  if (shortcutKey.length === 1) {
    return shortcutKey.toUpperCase();
  }
  return toTitleCase(shortcutKey);
}

export const shortcutUtils = {
  getKeyLabels,
};

export type ShortcutProps = {
  shortcutKey: string;
  withCtrl?: boolean;
  withShift?: boolean;
  withAlt?: boolean;
  variant?: 'text' | 'chip' | 'keys';
};
