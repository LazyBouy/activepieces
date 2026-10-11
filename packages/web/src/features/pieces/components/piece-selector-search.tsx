import { t } from 'i18next';
import { CircleX, Search } from 'lucide-react';

import { cn } from '@/lib/utils';

const PiecesSearchInput = ({
  value,
  onValueChange,
  inputRef,
  onKeyDown,
  isActive,
  listId,
  activeOptionId,
}: PiecesSearchInputProps) => {
  const hasQuery = value !== '';
  return (
    <div className="m-4 flex h-10 shrink-0 items-center gap-3 rounded-sm border border-canvas-divider bg-panel px-3 shadow-[0_2px_5px_rgb(0_0_0/4%)] transition-colors duration-200 focus-within:border-focus">
      <Search
        aria-hidden
        className={cn('size-4 shrink-0 text-gray-11', {
          'text-accent-9': hasQuery,
        })}
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('Search pieces')}
        data-testid={isActive ? 'pieces-search-input' : undefined}
        role="combobox"
        aria-expanded={true}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        spellCheck={false}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-12 outline-hidden placeholder:text-gray-11"
      />
      {hasQuery && (
        <button
          type="button"
          aria-label={t('Clear search')}
          className="flex shrink-0 cursor-pointer items-center text-gray-11 transition-colors hover:text-gray-12"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onValueChange('')}
        >
          <CircleX className="size-4" />
        </button>
      )}
    </div>
  );
};

PiecesSearchInput.displayName = 'PiecesSearchInput';
export { PiecesSearchInput };

type PiecesSearchInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  isActive: boolean;
  listId: string;
  activeOptionId: string | undefined;
};
