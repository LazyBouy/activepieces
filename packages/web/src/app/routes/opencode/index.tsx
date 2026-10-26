import { isNil } from '@activepieces/core-utils';
import {
  OpencodeProjectOptions,
  OpencodeProjectView,
} from '@activepieces/shared';
import { t } from 'i18next';
import { ExternalLink } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';

import { DataFetchErrorState } from '@/components/custom/data-fetch-error-state';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  OpencodeAgentCard,
  OpencodeItemBadges,
  OpencodeMcpServerList,
  OpencodeMemoryList,
  opencodeOptionsQueries,
  OpencodeProviderModels,
  opencodeViewsQueries,
} from '@/features/opencode';
import { authenticationSession } from '@/lib/authentication-session';
import { formatUtils } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

export function OpencodePage() {
  const projectId = authenticationSession.getProjectId() ?? '';
  const {
    data: options,
    isLoading,
    isError,
    refetch,
  } = opencodeOptionsQueries.useOptions({ projectId });
  const [selected, setSelected] = useState<string>(DEFAULT_VALUE);

  if (isLoading) {
    return <PageSkeleton />;
  }
  if (isError || isNil(options)) {
    return (
      <DataFetchErrorState
        entity={t('OpenCode settings')}
        onRetry={() => {
          refetch().catch(() => undefined);
        }}
      />
    );
  }
  if (!options.enabled) {
    return (
      <p className="text-sm text-gray-11">
        {t(
          'Run AI on OpenCode is off. A platform admin can turn it on in Platform → AI → OpenCode.',
        )}
      </p>
    );
  }
  const location = locationOf({ selected });
  return (
    <div className="flex w-full flex-col gap-4" data-testid="opencode-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold text-gray-12">
            {t('OpenCode')}
          </span>
          <span className="text-xs text-gray-11">
            {t(
              'What the AI steps of this project run with, read live from OpenCode. Change it in the OpenCode admin panel.',
            )}
          </span>
        </div>
        <ProjectPicker
          options={options}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
      <ProjectViewSections
        key={selected}
        projectId={projectId}
        namespace={location.namespace}
        project={location.project}
      />
    </div>
  );
}

function ProjectPicker({
  options,
  selected,
  onSelect,
}: {
  options: OpencodeProjectOptions;
  selected: string;
  onSelect: (value: string) => void;
}) {
  const defaultName = isNil(options.defaultLocation.project)
    ? options.defaultLocation.namespace
    : `${options.defaultLocation.namespace}/${options.defaultLocation.project}`;
  return (
    <Select value={selected} onValueChange={onSelect}>
      <SelectTrigger className="w-72">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_VALUE}>
          {t("This project's own ({name})", { name: defaultName })}
        </SelectItem>
        {options.namespaces.flatMap((namespace) =>
          namespace.projects.map((project) => (
            <SelectItem
              key={`${namespace.id}/${project.id}`}
              value={`${namespace.id}/${project.id}`}
            >
              {`${namespace.name} / ${project.name}`}
            </SelectItem>
          )),
        )}
      </SelectContent>
    </Select>
  );
}

function ProjectViewSections({
  projectId,
  namespace,
  project,
}: {
  projectId: string;
  namespace?: string;
  project?: string;
}) {
  const { data, isLoading, isError, refetch } =
    opencodeViewsQueries.useProjectView({ projectId, namespace, project });
  if (isLoading) {
    return <PageSkeleton />;
  }
  if (isError || isNil(data)) {
    return (
      <DataFetchErrorState
        entity={t('OpenCode project')}
        onRetry={() => {
          refetch().catch(() => undefined);
        }}
      />
    );
  }
  if (!isNil(data.error)) {
    return <p className="text-sm text-warning-11">{data.error}</p>;
  }
  if (isNil(data.view)) {
    return (
      <p className="text-sm text-gray-11">
        {t(
          "This project's OpenCode project is created the first time an AI step runs.",
        )}
      </p>
    );
  }
  return <ViewSections projectId={projectId} view={data.view} />;
}

function ViewSections({
  projectId,
  view,
}: {
  projectId: string;
  view: OpencodeProjectView;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section
        title={t('Agents')}
        link={view.links.agents}
        className="lg:col-span-2"
      >
        <span className="text-xs text-gray-11">
          {`${view.namespace}/${view.project} · ${view.folder}`}
        </span>
        <div className="flex flex-col divide-y divide-gray-6">
          {view.agents.map((agent) => (
            <div key={agent.name} className="flex flex-col gap-1 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-12">{agent.name}</span>
                <Badge variant="secondary" size="sm">
                  {agent.mode}
                </Badge>
                {!isNil(agent.origin) && (
                  <span className="text-xs text-gray-11">{agent.origin}</span>
                )}
              </div>
              {!isNil(agent.description) && (
                <span className="text-xs text-gray-11">
                  {agent.description}
                </span>
              )}
              <OpencodeAgentCard
                projectId={projectId}
                name={agent.name}
                namespace={view.namespace}
                project={view.project}
              />
            </div>
          ))}
        </div>
      </Section>
      <Section title={t('Tools')} link={view.links.capabilities}>
        <OpencodeItemBadges items={view.tools} empty={t('No tools')} />
      </Section>
      <Section title={t('Skills')} link={view.links.capabilities}>
        <OpencodeItemBadges items={view.skills} empty={t('No skills')} />
      </Section>
      <Section title={t('Commands')} link={view.links.capabilities}>
        <OpencodeItemBadges items={view.commands} empty={t('No commands')} />
      </Section>
      <Section title={t('MCP servers')} link={view.links.capabilities}>
        <OpencodeMcpServerList servers={view.mcpServers} />
      </Section>
      <Section title={t('Memory')} link={view.links.memory}>
        <OpencodeMemoryList levels={view.memory} />
      </Section>
      <Section title={t('Models')} link={view.links.models}>
        <span className="text-xs text-gray-12">
          {isNil(view.defaultModel)
            ? t('No default model')
            : t('Default: {model}', { model: view.defaultModel })}
          {!isNil(view.defaultModelFrom) && (
            <span className="text-gray-11">{` (${view.defaultModelFrom})`}</span>
          )}
        </span>
        {view.providers.map((provider) => (
          <OpencodeProviderModels key={provider.id} provider={provider} />
        ))}
      </Section>
      <Section
        title={t('Recent sessions from flows')}
        link={view.links.sessions}
        className="lg:col-span-2"
      >
        {view.sessions.length === 0 ? (
          <span className="text-xs text-gray-11">
            {t('No AI step of this project has run here yet.')}
          </span>
        ) : (
          <div className="flex flex-col divide-y divide-gray-6">
            {view.sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-gray-12">
                    {session.title}
                  </span>
                  <span className="text-xs text-gray-11">
                    {[
                      session.agent,
                      session.model,
                      `$${session.cost.toFixed(4)}`,
                      formatUtils.formatDateToAgo(new Date(session.updated)),
                    ]
                      .filter((part) => !isNil(part))
                      .join(' · ')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {!isNil(session.flowRunId) && (
                    <Link
                      to={authenticationSession.appendProjectRoutePrefix(
                        `/runs/${session.flowRunId}`,
                      )}
                      className="text-xs text-gray-11 hover:text-gray-12"
                    >
                      {t('View run')}
                    </Link>
                  )}
                  <a
                    href={session.adminPanelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-11 hover:text-gray-12"
                  >
                    <ExternalLink className="size-3" />
                    {t('Open in admin panel')}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  link,
  className,
  children,
}: {
  title: string;
  link: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border border-gray-6 p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-12">{title}</span>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gray-11 hover:text-gray-12"
        >
          <ExternalLink className="size-3" />
          {t('Edit in admin panel')}
        </a>
      </div>
      {children}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-32 w-full rounded-md" />
    </div>
  );
}

function locationOf({ selected }: { selected: string }): {
  namespace?: string;
  project?: string;
} {
  if (selected === DEFAULT_VALUE) {
    return {};
  }
  const [namespace, project] = selected.split('/');
  return { namespace, project };
}

const DEFAULT_VALUE = '__default__';
