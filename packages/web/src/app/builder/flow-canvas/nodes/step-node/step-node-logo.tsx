import { LogoPlate } from '@/components/custom/logo-plate';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const StepNodeLogo = ({
  isSkipped,
  isLoading,
  logoUrl,
  displayName,
}: {
  isSkipped: boolean;
  isLoading: boolean;
  logoUrl: string | undefined;
  displayName: string;
}) => {
  return (
    <LogoPlate
      src={isLoading ? undefined : logoUrl}
      alt={displayName}
      size="canvas"
      className={cn('bg-panel', {
        'opacity-50 grayscale': isSkipped,
      })}
      fallback={<Skeleton className="size-10 rounded-sm" />}
    />
  );
};

export { StepNodeLogo };
