import { Badge } from '@/components/ui/badge';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function DataTableFilterTrigger({
  icon: Icon,
  leading,
  label,
  value,
  className,
  children,
  ...props
}: DataTableFilterTriggerProps) {
  const hasValue = value !== undefined && value !== null && value !== '';
  return (
    <Button
      type="button"
      variant="outline"
      data-active={hasValue || undefined}
      className={cn(
        'max-w-full font-medium data-active:inset-ring-gray-8 data-active:enabled:hover:inset-ring-gray-8',
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="size-4 shrink-0 text-gray-11" />}
      {leading && (
        <span className="flex shrink-0 text-gray-11 [&_svg]:size-4">
          {leading}
        </span>
      )}
      {label && <span className="truncate">{label}</span>}
      {children}
      {hasValue && (
        <Badge variant="tag" size="sm" className="min-w-0 max-w-40">
          <span className="truncate">{value}</span>
        </Badge>
      )}
    </Button>
  );
}

export { DataTableFilterTrigger };

type DataTableFilterTriggerProps = Omit<ButtonProps, 'value'> & {
  icon?: React.ComponentType<{ className?: string }>;
  leading?: React.ReactNode;
  label?: React.ReactNode;
  value?: React.ReactNode;
};
