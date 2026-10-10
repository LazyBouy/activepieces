import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      tabIndex={-1}
      className={cn(
        'fixed inset-0 z-50 bg-scrim backdrop-blur-sm outline-hidden data-[state=open]:motion-safe:animate-overlay-in data-[state=closed]:motion-safe:animate-overlay-out',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  showOverlay = true,
  overlayClassName,
  size = 'md',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & DialogContentProps) {
  return (
    <DialogPortal data-slot="dialog-portal">
      {showOverlay && <DialogOverlay className={overlayClassName} />}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-size={size}
        className={cn(
          'fixed top-[50%] left-[50%] z-50 grid w-[calc(100%-1.5rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg bg-panel p-6 shadow-dialog outline-hidden dark:bg-gray-4 data-[state=open]:motion-safe:animate-dialog-in data-[state=closed]:motion-safe:animate-dialog-out',
          DIALOG_SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 flex size-6 items-center justify-center rounded-sm text-gray-11 transition-colors outline-hidden hover:bg-gray-4 hover:text-gray-12 dark:hover:bg-gray-5 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-0 focus-visible:outline-focus-halo disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [[data-slot=dialog-content]>&]:mt-1',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        'text-lg leading-snug font-medium tracking-tight text-gray-12',
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-gray-12/87', className)}
      {...props}
    />
  );
}

const DIALOG_SIZE_CLASSES: Record<DialogSize, string> = {
  sm: 'max-w-90',
  md: 'max-w-120',
  lg: 'max-w-141',
  xl: 'max-w-160',
  '2xl': 'max-w-195',
};

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};

type DialogContentProps = {
  showCloseButton?: boolean;
  showOverlay?: boolean;
  overlayClassName?: string;
  size?: DialogSize;
};

type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

type DialogFooterProps = {
  showCloseButton?: boolean;
};
