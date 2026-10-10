import { cn } from '@/lib/utils';

const toTitleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
export type ShortcutProps = {
  //can't name it key because it conflicts with the key prop of the component
  shortcutKey: string;
  withCtrl?: boolean;
  withShift?: boolean;
  variant?: 'text' | 'chip';
};

export const Shortcut = ({
  shortcutKey,
  withCtrl,
  withShift,
  variant = 'text',
  className,
}: ShortcutProps & { className?: string }) => {
  const isMac = /(Mac)/i.test(navigator.userAgent);
  const isEscape = shortcutKey?.toLocaleLowerCase() === 'esc';

  if (variant === 'chip') {
    const keys = [
      !isEscape && withCtrl ? (isMac ? '⌘' : 'Ctrl') : null,
      !isEscape && withShift ? 'Shift' : null,
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
      {!isEscape && (withCtrl || withShift) && ' + '}
      {shortcutKey && toTitleCase(shortcutKey)}
    </span>
  );
};
