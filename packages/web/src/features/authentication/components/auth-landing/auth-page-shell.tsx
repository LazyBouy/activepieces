import { FullLogo } from '@/components/custom/full-logo';
import { cn } from '@/lib/utils';

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-y-auto bg-gray-1">
      <div className="flex min-h-full w-full flex-col items-center px-4 pt-9 pb-8">
        <FullLogo className="flex h-10 shrink-0 justify-center" />
        <div className="mt-7.5 flex w-full justify-center">{children}</div>
      </div>
    </div>
  );
}

export function AuthCard({
  className,
  children,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="auth-card"
      className={cn(
        'w-full max-w-88 rounded-lg border border-gray-6 bg-panel p-6 text-gray-12 shadow-[0_4px_16px_0_rgb(99_77_255/6%)] dark:shadow-none',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
