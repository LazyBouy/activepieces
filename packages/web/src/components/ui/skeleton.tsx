import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-skeleton-sweep rounded-lg bg-gray-3 bg-linear-to-r from-gray-3 from-25% via-gray-1 via-37% to-gray-3 to-63% bg-size-[400%_100%] motion-reduce:bg-none',
        className,
      )}
      {...props}
    />
  );
}

function SkeletonList({
  className,
  numberOfItems = 3,
  ...props
}: React.ComponentProps<'div'> & {
  numberOfItems?: number;
}) {
  const array = Array(numberOfItems).fill(null);
  return (
    <div className="space-y-4">
      {array.map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4 w-full', className)}
          {...props}
        />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonList };
