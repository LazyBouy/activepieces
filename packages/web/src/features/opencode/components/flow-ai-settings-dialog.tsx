import {
  OpencodeDefaults,
  OpencodeSessionMode,
  opencodeStepUtil,
} from '@activepieces/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { t } from 'i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const FlowAiSettingsDialog = ({
  open,
  onOpenChange,
  defaults,
  readonly,
  onSave,
}: FlowAiSettingsDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('AI settings')}</DialogTitle>
        <DialogDescription>
          {t(
            'Defaults for the AI steps of this flow. A step can change them in its Settings tab.',
          )}
        </DialogDescription>
      </DialogHeader>
      <FlowAiSettingsForm
        key={open ? 'open' : 'closed'}
        defaults={defaults}
        readonly={readonly}
        onSave={onSave}
        onOpenChange={onOpenChange}
      />
    </DialogContent>
  </Dialog>
);

const FlowAiSettingsForm = ({
  defaults,
  readonly,
  onSave,
  onOpenChange,
}: FlowAiSettingsFormProps) => {
  const form = useForm<FlowAiSettingsValues>({
    mode: 'onChange',
    resolver: zodResolver(FlowAiSettingsSchema),
    defaultValues: {
      sessionMode: opencodeStepUtil.resolveFlowSessionMode({ defaults }),
    },
    disabled: readonly,
  });

  const handleSubmit = (values: FlowAiSettingsValues) => {
    onSave({ sessionMode: values.sessionMode });
    onOpenChange(false);
  };

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          control={form.control}
          name="sessionMode"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-1">
              <FormLabel>{t('Session')}</FormLabel>
              <Select
                disabled={field.disabled}
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW_PER_STEP">
                    {t('New for each step')}
                  </SelectItem>
                  <SelectItem value="ONE_PER_RUN">
                    {t('One per flow run')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-gray-11">
                {field.value === 'ONE_PER_RUN'
                  ? t(
                      'The AI steps of a run share one OpenCode session and take turns, one at a time.',
                    )
                  : t('Each AI step starts a new OpenCode session.')}
              </span>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          {!readonly && <Button type="submit">{t('Save')}</Button>}
        </DialogFooter>
      </form>
    </Form>
  );
};

const FlowAiSettingsSchema = z.object({
  sessionMode: OpencodeSessionMode,
});

type FlowAiSettingsValues = z.infer<typeof FlowAiSettingsSchema>;

type FlowAiSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults: OpencodeDefaults | undefined;
  readonly: boolean;
  onSave: (defaults: OpencodeDefaults) => void;
};

type FlowAiSettingsFormProps = Omit<FlowAiSettingsDialogProps, 'open'>;
