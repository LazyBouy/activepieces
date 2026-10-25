import { OpencodeConnection } from '@activepieces/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { t } from 'i18next';
import { ExternalLink, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { DataFetchErrorState } from '@/components/custom/data-fetch-error-state';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  opencodeConnectionMutations,
  opencodeConnectionQueries,
} from '@/features/opencode';
import { api } from '@/lib/api';

import { SectionHeader } from '../components/section-header';

import { AllowlistField } from './allowlist-field';
import { ConnectionStatus } from './connection-status';
import {
  opencodeForm,
  OpencodeFormSchema,
  OpencodeFormValues,
} from './opencode-form';

export function OpencodeTab() {
  const {
    data: connection,
    isLoading,
    isError,
    refetch,
  } = opencodeConnectionQueries.useConnection();

  if (isLoading) {
    return <OpencodeSkeleton />;
  }
  if (isError || connection === undefined) {
    return (
      <DataFetchErrorState
        entity={t('OpenCode connection')}
        onRetry={refetch}
      />
    );
  }
  return <OpencodeSettings key={connection.id} connection={connection} />;
}

function OpencodeSettings({ connection }: { connection: OpencodeConnection }) {
  const form = useForm<OpencodeFormValues>({
    defaultValues: opencodeForm.toFormValues(connection),
    resolver: zodResolver(OpencodeFormSchema),
    mode: 'onChange',
  });
  const clearPassword = form.watch('clearPassword');
  const { mutate: save, isPending } = opencodeConnectionMutations.useUpdate({
    onSuccess: (saved) => {
      form.reset(opencodeForm.toFormValues(saved));
      toast.success(t('Your changes have been saved.'), { duration: 3000 });
    },
    onError: (error) => {
      form.setError('root.serverError', {
        type: 'manual',
        message: api.extractServerErrorMessage(
          error,
          t('Failed to save changes. Please try again.'),
        ),
      });
    },
  });

  const handleSubmit = (values: OpencodeFormValues) => {
    form.clearErrors('root.serverError');
    save(opencodeForm.toRequest(values));
  };

  return (
    <Form {...form}>
      <form
        className="flex w-full max-w-[40rem] flex-col gap-8"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <div className="flex items-start justify-between gap-4">
          <SectionHeader
            isPageTitle
            title={t('OpenCode')}
            description={t(
              'AI steps run on an OpenCode server. Agents, sessions, models and their settings live in the OpenCode admin panel.',
            )}
          />
          <Button type="button" variant="outline" size="sm" asChild>
            <a
              href={connection.adminPanelUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              {t('Open admin panel')}
            </a>
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <ConnectionStatus connection={connection} />
          <Item variant="outline">
            <ItemMedia variant="icon">
              <Sparkles />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t('Run AI on OpenCode')}</ItemTitle>
              <ItemDescription className="line-clamp-none">
                {t(
                  'When on, AI steps run only on OpenCode and fail with a clear error if it cannot be reached. When off, they run on the AI providers set up here.',
                )}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem>
                    <Switch
                      aria-label={t('Run AI on OpenCode')}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </ItemActions>
          </Item>
        </div>

        <div className="flex flex-col gap-4">
          <SectionHeader
            title={t('Server')}
            description={t('Where OpenCode runs and how to sign in to it.')}
          />
          <TextField
            form={form}
            name="serverUrl"
            label={t('Server URL')}
            description={t('The address AI steps send their work to.')}
            disabled={isPending}
          />
          <TextField
            form={form}
            name="username"
            label={t('Username')}
            disabled={isPending}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Password')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="off"
                    disabled={isPending || clearPassword}
                    placeholder={
                      connection.hasPassword && !clearPassword
                        ? t('Enter a new password to replace the saved one')
                        : t('Leave empty when OpenCode has no password')
                    }
                  />
                </FormControl>
                {connection.hasPassword && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="self-start px-0"
                    onClick={() =>
                      form.setValue('clearPassword', !clearPassword, {
                        shouldDirty: true,
                      })
                    }
                  >
                    {clearPassword
                      ? t('Keep the saved password')
                      : t('Remove the saved password')}
                  </Button>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <TextField
            form={form}
            name="adminPanelUrl"
            label={t('Admin panel URL')}
            description={t('Used for every Open in admin panel link.')}
            disabled={isPending}
          />
          <TextField
            form={form}
            name="callbackUrl"
            label={t('Callback URL')}
            description={t(
              'How OpenCode reaches this server to use the tools of agent steps.',
            )}
            disabled={isPending}
          />
          <TextField
            form={form}
            name="projectsFolder"
            label={t('Projects folder')}
            description={t(
              'Where the OpenCode project for each project here is created. Leave empty to use the folder of the iphi-flow namespace.',
            )}
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-4">
          <SectionHeader
            title={t('Permission requests')}
            description={t(
              'How long a step waits for someone to answer when OpenCode asks for permission.',
            )}
          />
          <FormField
            control={form.control}
            name="askCapHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Wait at most (hours)')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    value={Number.isNaN(field.value) ? '' : field.value}
                    onChange={(event) =>
                      field.onChange(event.target.valueAsNumber)
                    }
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-4">
          <SectionHeader
            title={t('Allowlist')}
            description={t(
              'The OpenCode namespaces and projects flows may use.',
            )}
          />
          <AllowlistField control={form.control} disabled={isPending} />
        </div>

        {form.formState.errors.root?.serverError && (
          <p className="text-sm text-danger-11">
            {form.formState.errors.root.serverError.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={isPending}
            disabled={!form.formState.isDirty}
          >
            {t('Save')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function TextField({
  form,
  name,
  label,
  description,
  disabled,
}: TextFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} disabled={disabled} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function OpencodeSkeleton() {
  return (
    <div className="flex w-full max-w-[40rem] flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-[4.5rem] w-full rounded-lg" />
      <Skeleton className="h-[4.5rem] w-full rounded-lg" />
    </div>
  );
}

type TextFieldProps = {
  form: ReturnType<typeof useForm<OpencodeFormValues>>;
  name:
    | 'serverUrl'
    | 'username'
    | 'adminPanelUrl'
    | 'callbackUrl'
    | 'projectsFolder';
  label: string;
  description?: string;
  disabled: boolean;
};
