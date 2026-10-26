import { isNil } from '@activepieces/core-utils';
import { t } from 'i18next';

import { DataFetchErrorState } from '@/components/custom/data-fetch-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  OpencodeProviderModels,
  opencodeViewsQueries,
} from '@/features/opencode';

import { SectionHeader } from '../components/section-header';

export function ServerOverview({
  adminPanelUrl,
  allowlist,
}: {
  adminPanelUrl: string;
  allowlist: string[];
}) {
  const { data, isLoading, isError, refetch } =
    opencodeViewsQueries.useServerOverview({ allowlist });

  return (
    <div className="flex flex-col gap-4" data-testid="opencode-server-overview">
      <SectionHeader
        title={t('In OpenCode')}
        description={t(
          'Read live from OpenCode. Projects, providers and models are changed in the OpenCode admin panel.',
        )}
      />
      {isLoading && <Skeleton className="h-24 w-full rounded-md" />}
      {isError && (
        <DataFetchErrorState
          entity={t('OpenCode overview')}
          onRetry={() => {
            refetch().catch(() => undefined);
          }}
        />
      )}
      {!isNil(data) && (
        <>
          {!isNil(data.error) && (
            <span className="text-xs text-warning-11">
              {t('OpenCode did not answer fully: {reason}', {
                reason: data.error,
              })}
            </span>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-11">
              {t('Allowlisted projects')}
            </span>
            {data.allowed.length === 0 ? (
              <span className="text-xs text-gray-11">
                {t('Nothing from OpenCode is allowlisted yet.')}
              </span>
            ) : (
              data.allowed.map((namespace) => (
                <div key={namespace.id} className="flex flex-col gap-0.5">
                  <span className="text-sm text-gray-12">{namespace.name}</span>
                  {namespace.projects.length === 0 ? (
                    <span className="pl-4 text-xs text-gray-11">
                      {t('No projects yet')}
                    </span>
                  ) : (
                    namespace.projects.map((project) => (
                      <span
                        key={project.id}
                        className="pl-4 text-xs text-gray-11"
                      >
                        {`${project.name} · ${project.folder}`}
                      </span>
                    ))
                  )}
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-11">
                {t('Providers and models')}
              </span>
              <a
                href={`${adminPanelUrl.replace(/\/+$/, '')}/operator/models`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-11 hover:text-gray-12"
              >
                {t('Edit in admin panel')}
              </a>
            </div>
            {data.providers.length === 0 ? (
              <span className="text-xs text-gray-11">
                {t('No provider is connected in OpenCode.')}
              </span>
            ) : (
              data.providers.map((provider) => (
                <OpencodeProviderModels key={provider.id} provider={provider} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
