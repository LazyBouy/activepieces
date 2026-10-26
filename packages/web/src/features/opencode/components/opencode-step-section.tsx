import { isNil } from '@activepieces/core-utils';
import {
  OpencodeAgentSummary,
  OpencodeCatalogNamespace,
  OpencodeCatalogProject,
  OpencodeProjectOptions,
  OpencodeSessionMode,
  OpencodeStepSettings,
} from '@activepieces/shared';
import { t } from 'i18next';
import { ExternalLink, Sparkles } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { opencodeOptionsQueries } from '../hooks/opencode-options-hooks';

import { OpencodeAgentCard } from './opencode-agent-card';

export const OpencodeStepSection = ({
  projectId,
  readonly,
  flowSessionMode,
}: OpencodeStepSectionProps) => {
  const { data: options, isError } = opencodeOptionsQueries.useOptions({
    projectId,
  });

  return (
    <div className="flex flex-col gap-3 border-t border-gray-6 pt-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-gray-11">
            <Sparkles className="size-4" />
            <span className="text-xsm font-semibold text-gray-11">
              {t('OpenCode')}
            </span>
          </div>
          <span className="text-xs text-gray-11">
            {t('Where this step runs and which session it uses.')}
          </span>
        </div>
        {options?.enabled && (
          <Button type="button" variant="outline" size="sm" asChild>
            <a
              href={options.adminPanelUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              {t('Open admin panel')}
            </a>
          </Button>
        )}
      </div>
      {isError && (
        <span className="text-xs text-gray-11">
          {t('Could not load the OpenCode settings.')}
        </span>
      )}
      {!isNil(options) && !options.enabled && (
        <span className="text-xs text-gray-11">
          {t('Run AI on OpenCode is off')}
        </span>
      )}
      {!isNil(options) && options.enabled && (
        <OpencodePickers
          projectId={projectId}
          readonly={readonly}
          flowSessionMode={flowSessionMode}
          options={options}
        />
      )}
    </div>
  );
};

const OpencodePickers = ({
  projectId,
  readonly,
  flowSessionMode,
  options,
}: OpencodePickersProps) => {
  const form = useFormContext<OpencodeStepForm>();
  const watched = useWatch({
    control: form.control,
    name: 'settings.opencode',
  });
  const current: OpencodeStepSettings = watched ?? {};
  const locationComplete = isNil(current.namespace) === isNil(current.project);
  const { data: agentList } = opencodeOptionsQueries.useAgents({
    projectId,
    namespace: current.namespace,
    project: current.project,
    enabled: locationComplete,
  });

  const namespaces = withMissingNamespace({
    namespaces: options.namespaces.filter(
      (namespace) => namespace.projects.length > 0,
    ),
    selected: current.namespace,
  });
  const selectedNamespace = namespaces.find(
    (namespace) => namespace.id === current.namespace,
  );
  const projects = withMissingProject({
    projects: selectedNamespace?.projects ?? [],
    selected: current.project,
  });
  const agents = withMissingAgent({
    agents: (agentList?.agents ?? []).filter(
      (agent) => agent.name !== options.defaultLocation.agent,
    ),
    selected: current.agent,
  });
  const agentDescription = agents.find(
    (agent) => agent.name === current.agent,
  )?.description;
  const agentError = agentList?.error;
  const allowedNamespace = options.namespaces.find(
    (namespace) => namespace.id === current.namespace,
  );
  const notAllowlisted =
    !isNil(current.namespace) &&
    (isNil(allowedNamespace) ||
      (!isNil(current.project) &&
        !allowedNamespace.projects.some(
          (project) => project.id === current.project,
        )));

  const update = (next: OpencodeStepSettings) => {
    form.setValue('settings.opencode', emptyToUndefined(next), {
      shouldValidate: true,
    });
  };

  return (
    <>
      <FormField
        control={form.control}
        name="settings.opencode.sessionMode"
        render={() => (
          <FormItem className="flex flex-col gap-1">
            <Label>{t('Session')}</Label>
            <Select
              disabled={readonly}
              value={current.sessionMode ?? DEFAULT_VALUE}
              onValueChange={(value) =>
                update({
                  ...current,
                  sessionMode: OpencodeSessionMode.safeParse(value).data,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_VALUE}>
                  {t('Flow default: {mode}', {
                    mode: sessionModeLabel(flowSessionMode),
                  })}
                </SelectItem>
                {OpencodeSessionMode.options.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {sessionModeLabel(mode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-11">
              {(current.sessionMode ?? flowSessionMode) === 'ONE_PER_RUN'
                ? t(
                    'The AI steps that share the run session take turns, one at a time.',
                  )
                : t('This step starts a new session.')}
            </span>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="settings.opencode.namespace"
        render={() => (
          <FormItem className="flex flex-col gap-1">
            <Label>{t('Namespace')}</Label>
            <Select
              disabled={readonly}
              value={current.namespace ?? DEFAULT_VALUE}
              onValueChange={(value) =>
                update({
                  ...current,
                  namespace: value === DEFAULT_VALUE ? undefined : value,
                  project: undefined,
                  agent: undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_VALUE}>
                  {t('Default ({name})', {
                    name: options.defaultLocation.namespace,
                  })}
                </SelectItem>
                {namespaces.map((namespace) => (
                  <SelectItem key={namespace.id} value={namespace.id}>
                    {namespace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="settings.opencode.project"
        render={() => (
          <FormItem className="flex flex-col gap-1">
            <Label>{t('Project')}</Label>
            {isNil(current.namespace) ? (
              <Select disabled value={DEFAULT_VALUE}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_VALUE}>
                    {t("This project's own")}
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select
                disabled={readonly}
                value={current.project ?? ''}
                onValueChange={(value) =>
                  update({ ...current, project: value, agent: undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Pick a project')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isNil(current.namespace) &&
              isNil(options.defaultLocation.project) && (
                <span className="text-xs text-gray-11">
                  {t(
                    'It is created in OpenCode the first time an AI step runs.',
                  )}
                </span>
              )}
            {notAllowlisted && (
              <span className="text-xs text-warning-11">
                {t(
                  'This namespace or project is not allowlisted. A platform admin can add it in Platform → AI → OpenCode.',
                )}
              </span>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="settings.opencode.agent"
        render={() => (
          <FormItem className="flex flex-col gap-1">
            <Label>{t('Agent')}</Label>
            <Select
              disabled={readonly || !locationComplete}
              value={current.agent ?? DEFAULT_VALUE}
              onValueChange={(value) =>
                update({
                  ...current,
                  agent: value === DEFAULT_VALUE ? undefined : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_VALUE}>
                  {t('Default ({name})', {
                    name: options.defaultLocation.agent,
                  })}
                </SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.name} value={agent.name}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isNil(agentDescription) && (
              <span className="text-xs text-gray-11">{agentDescription}</span>
            )}
            {!isNil(agentError) && (
              <span className="text-xs text-warning-11">
                {t('Could not load agents from OpenCode: {reason}', {
                  reason: agentError,
                })}
              </span>
            )}
            {locationComplete && (
              <OpencodeAgentCard
                key={`${current.namespace}/${current.project}/${current.agent}`}
                projectId={projectId}
                name={current.agent ?? options.defaultLocation.agent}
                namespace={current.namespace}
                project={current.project}
              />
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};

function sessionModeLabel(mode: OpencodeSessionMode): string {
  return mode === 'ONE_PER_RUN'
    ? t('Shared across this run')
    : t('New for this step');
}

function emptyToUndefined(
  settings: OpencodeStepSettings,
): OpencodeStepSettings | undefined {
  return Object.values(settings).some((value) => !isNil(value))
    ? settings
    : undefined;
}

function withMissingNamespace({
  namespaces,
  selected,
}: {
  namespaces: OpencodeCatalogNamespace[];
  selected: string | undefined;
}): OpencodeCatalogNamespace[] {
  if (isNil(selected) || namespaces.some(({ id }) => id === selected)) {
    return namespaces;
  }
  return [
    ...namespaces,
    { id: selected, name: selected, folder: '', projects: [] },
  ];
}

function withMissingProject({
  projects,
  selected,
}: {
  projects: OpencodeCatalogProject[];
  selected: string | undefined;
}): OpencodeCatalogProject[] {
  if (isNil(selected) || projects.some(({ id }) => id === selected)) {
    return projects;
  }
  return [...projects, { id: selected, name: selected, folder: '' }];
}

function withMissingAgent({
  agents,
  selected,
}: {
  agents: OpencodeAgentSummary[];
  selected: string | undefined;
}): OpencodeAgentSummary[] {
  if (isNil(selected) || agents.some(({ name }) => name === selected)) {
    return agents;
  }
  return [...agents, { name: selected, mode: 'primary' }];
}

const DEFAULT_VALUE = '__default__';

type OpencodeStepForm = {
  settings: {
    opencode?: OpencodeStepSettings;
  };
};

type OpencodeStepSectionProps = {
  projectId: string;
  readonly: boolean;
  flowSessionMode: OpencodeSessionMode;
};

type OpencodePickersProps = OpencodeStepSectionProps & {
  options: OpencodeProjectOptions;
};
