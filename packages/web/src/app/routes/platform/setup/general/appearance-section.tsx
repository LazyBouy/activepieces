import { formErrors } from '@activepieces/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { platformApi } from '@/api/platforms-api';
import { FeatureBanner } from '@/app/components/feature-banner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { flagsHooks } from '@/hooks/flags-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import { AdminControl, adminControl } from '@/lib/admin-control';

export const AppearanceSection = () => {
  const queryClient = useQueryClient();
  const { platform } = platformHooks.useCurrentPlatform();
  const brandingLocked = !platform.plan.customAppearanceEnabled;

  const form = useForm<PlatformAppearanceSchema>({
    defaultValues: {
      name: platform.name,
    },
    resolver: zodResolver(PlatformAppearanceSchema),
    mode: 'onChange',
  });

  const [fileInputsKey, setFileInputsKey] = useState(0);
  const [hasChosenFiles, setHasChosenFiles] = useState(false);
  const { isDirty, errors } = form.formState;
  const hasFieldErrors = Object.keys(errors).some((field) => field !== 'root');
  const hasChanges = isDirty || hasChosenFiles;
  const clearChosenFiles = () => {
    setHasChosenFiles(false);
    setFileInputsKey((key) => key + 1);
  };

  const logoRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const { mutate: updatePlatform, isPending } = useMutation({
    mutationFn: async () => {
      form.clearErrors('root.serverError');
      const logo = logoRef.current?.files?.[0];
      const icon = iconRef.current?.files?.[0];
      const favicon = faviconRef.current?.files?.[0];
      const { name } = form.getValues();

      const formdata = new FormData();
      formdata.append('name', name);
      if (!brandingLocked) {
        if (logo) formdata.append('fullLogo', logo);
        if (icon) formdata.append('logoIcon', icon);
        if (favicon) formdata.append('favIcon', favicon);
      }

      await platformApi.updateWithFormData(formdata, platform.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform', platform.id] }),
        queryClient.invalidateQueries({ queryKey: flagsHooks.queryKey }),
      ]);
    },
    onSuccess: () => {
      clearChosenFiles();
      toast.success(t('Your changes have been saved.'), { duration: 3000 });
      form.reset(form.getValues());
    },
    onError: () => {
      form.setError('root.serverError', {
        type: 'manual',
        message: t('Failed to save changes. Please try again.'),
      });
    },
  });

  return (
    <div className="grid gap-4">
      <Form {...form}>
        <form
          className="grid space-y-4 mt-4"
          onSubmit={form.handleSubmit(() => updatePlatform())}
        >
          <div className="max-w-[600px] grid space-y-4">
            <FormField
              name="name"
              render={({ field }) => (
                <FormItem className="grid space-y-2">
                  <FormLabel htmlFor="name">{t('Platform Name')}</FormLabel>
                  <Input
                    {...field}
                    required
                    id="name"
                    placeholder={t('Platform Name')}
                    className="rounded-sm"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {brandingLocked && (
              <FeatureBanner
                message={t(
                  'Your logo and favicon are part of custom branding.',
                )}
              />
            )}

            <div className="grid space-y-2">
              <Label htmlFor="logoFile">{t('Logo')}</Label>
              <Input
                type="file"
                key={fileInputsKey}
                ref={logoRef}
                onChange={() => setHasChosenFiles(true)}
                defaultFileName={platform.fullLogoUrl}
                accept="image/*"
                id="logoFile"
                disabled={brandingLocked}
                className="rounded-sm"
              />
            </div>
            <div className="grid space-y-2">
              <Label htmlFor="iconFile">{t('Icon')}</Label>
              <Input
                type="file"
                key={fileInputsKey}
                ref={iconRef}
                onChange={() => setHasChosenFiles(true)}
                defaultFileName={platform.logoIconUrl}
                accept="image/*"
                id="iconFile"
                disabled={brandingLocked}
                className="rounded-sm"
              />
            </div>
            <div className="grid space-y-2">
              <Label htmlFor="faviconFile">{t('Favicon')}</Label>
              <Input
                type="file"
                key={fileInputsKey}
                ref={faviconRef}
                onChange={() => setHasChosenFiles(true)}
                defaultFileName={platform.favIconUrl}
                accept="image/*"
                id="faviconFile"
                disabled={brandingLocked}
                className="rounded-sm"
              />
            </div>

            {form?.formState?.errors?.root?.serverError && (
              <FormMessage>
                {form.formState.errors.root.serverError.message}
              </FormMessage>
            )}
            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-sm text-gray-11">
                {hasChanges && (
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-warning-9" />
                    {t('You have unsaved changes')}
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasChanges || isPending}
                  onClick={() => {
                    form.reset();
                    clearChosenFiles();
                  }}
                >
                  {t('Cancel')}
                </Button>
                <Button
                  {...adminControl(AdminControl.GENERAL_APPEARANCE_SUBMIT)}
                  type="submit"
                  loading={isPending}
                  disabled={!hasChanges || hasFieldErrors}
                >
                  {t('Save')}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

const PlatformAppearanceSchema = z.object({
  name: z.string().min(1, formErrors.required),
});

type PlatformAppearanceSchema = z.infer<typeof PlatformAppearanceSchema>;
