import { cn } from '@/lib/utils';

export function SectionHeader({
  title,
  count,
  description,
  isPageTitle = false,
}: {
  title: string;
  count?: number;
  description: string;
  isPageTitle?: boolean;
}) {
  const Heading = isPageTitle ? 'h1' : 'h2';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <Heading
          className={cn('font-semibold', {
            'text-xl leading-tight text-gray-12': isPageTitle,
            'text-base tracking-tight': !isPageTitle,
          })}
        >
          {title}
        </Heading>
        {count !== undefined && (
          <span className="text-sm text-gray-11 tabular-nums">{count}</span>
        )}
      </div>
      <p className="text-sm text-gray-11">{description}</p>
    </div>
  );
}
