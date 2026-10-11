import { t } from 'i18next';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

const PiecePanelRootHeader = ({
  title,
  subtitle,
}: PiecePanelRootHeaderProps) => {
  return (
    <div data-piece-panel-header="root" className={HEADER_CLASS_NAME}>
      <h2 className="text-lg leading-5.5 font-semibold text-gray-12">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm leading-4.75 text-gray-11">{subtitle}</p>
      )}
    </div>
  );
};

const PiecePanelSubViewHeader = ({
  icon,
  title,
  description,
  onBack,
}: PiecePanelSubViewHeaderProps) => {
  return (
    <div
      data-piece-panel-header="sub-view"
      className={cn(HEADER_CLASS_NAME, 'flex items-start')}
    >
      <button
        type="button"
        aria-label={t('Back')}
        data-piece-panel-back
        className="mr-3 flex h-5.5 shrink-0 cursor-pointer items-center rounded-sm text-gray-11 outline-hidden transition-colors hover:text-gray-12 focus-visible:outline-2 focus-visible:outline-focus-halo"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onBack}
      >
        <ArrowLeft className="size-5" />
      </button>
      <span className="mr-4 flex h-5.5 shrink-0 items-center text-gray-11 [&>svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg leading-5.5 font-semibold text-gray-12">
          {title}
        </h2>
        {description && (
          <p className="mt-1 line-clamp-2 text-sm leading-4.75 text-gray-11">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

const HEADER_CLASS_NAME =
  'shrink-0 border-b border-canvas-divider bg-canvas-panel-header p-4 @max-[427px]/builder-body:pr-14';

export { PiecePanelRootHeader, PiecePanelSubViewHeader };

type PiecePanelRootHeaderProps = {
  title: string;
  subtitle: string | null;
};

type PiecePanelSubViewHeaderProps = {
  icon: React.ReactNode;
  title: string;
  description: string | null;
  onBack: () => void;
};
