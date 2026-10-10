import { cn } from '@/lib/utils';

const LargeWidgetWrapper = ({
  children,
  containerClassName,
}: {
  children: React.ReactNode;
  containerClassName?: string;
}) => {
  return (
    <div className="pointer-events-none absolute top-10 z-40 flex w-full justify-center px-4">
      <div
        className={cn(
          'pointer-events-auto flex max-w-full items-center justify-between gap-3 rounded-sm border border-gray-6 bg-panel p-3 text-xs leading-normal text-gray-12/87 motion-safe:animate-overlay-in',
          containerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
};
LargeWidgetWrapper.displayName = 'LargeWidgetWrapper';
export default LargeWidgetWrapper;
