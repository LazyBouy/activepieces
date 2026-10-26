import { isNil } from '@activepieces/core-utils';
import {
  OpencodeAccess,
  OpencodeAgentCard as OpencodeAgentCardData,
  OpencodeMcpServerView,
  OpencodeMemoryLevelView,
  OpencodeNamedItem,
} from '@activepieces/shared';
import { t } from 'i18next';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { ReactNode, useState } from 'react';

import { DataFetchErrorState } from '@/components/custom/data-fetch-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';

import { opencodeViewsQueries } from '../hooks/opencode-views-hooks';

export const OpencodeAgentCard = ({
  projectId,
  name,
  namespace,
  project,
}: OpencodeAgentCardProps) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } =
    opencodeViewsQueries.useAgentCard({
      projectId,
      name,
      namespace,
      project,
      enabled: open,
    });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start px-0 text-gray-11"
        >
          {open ? <ChevronDown /> : <ChevronRight />}
          {t('Agent details')}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {isLoading && <Skeleton className="h-24 w-full rounded-md" />}
        {isError && (
          <DataFetchErrorState
            entity={t('agent details')}
            onRetry={() => {
              refetch().catch(() => undefined);
            }}
          />
        )}
        {!isNil(data?.error) && (
          <span className="text-xs text-warning-11">{data.error}</span>
        )}
        {!isNil(data) && isNil(data.card) && isNil(data.error) && (
          <span className="text-xs text-gray-11">
            {t(
              'The details show once the OpenCode project exists, after the first AI step runs.',
            )}
          </span>
        )}
        {!isNil(data?.card) && <OpencodeAgentCardBody card={data.card} />}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const OpencodeAgentCardBody = ({
  card,
}: {
  card: OpencodeAgentCardData;
}) => {
  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-gray-6 p-3"
      data-testid="opencode-agent-card"
    >
      <CardSection title={t('Model')} link={card.links.agent}>
        <span className="text-xs text-gray-12">
          {card.model ?? t('No model available')}
        </span>
        <span className="text-xs text-gray-11">
          {[
            isNil(card.modelFrom)
              ? null
              : t('from {source}', { source: card.modelFrom }),
            t('mode {mode}', { mode: card.mode }),
            isNil(card.steps)
              ? null
              : t('at most {steps} steps', { steps: card.steps }),
          ]
            .filter((part) => !isNil(part))
            .join(' · ')}
        </span>
      </CardSection>
      <CardSection title={t('Tools')} link={card.links.tools}>
        <BadgeList
          items={card.tools.map((tool) => ({
            key: tool.name,
            label: tool.source.startsWith('mcp:')
              ? `${tool.name} (${tool.source.slice(4)})`
              : tool.name,
          }))}
          empty={t('No tools')}
        />
        {card.hiddenTools.length > 0 && (
          <span className="text-xs text-gray-11">
            {t('Not available: {tools}', {
              tools: card.hiddenTools
                .map((tool) => `${tool.name} (${tool.reason})`)
                .join(', '),
            })}
          </span>
        )}
      </CardSection>
      <CardSection title={t('Skills')} link={card.links.tools}>
        <AccessList items={card.skills} empty={t('No skills')} />
      </CardSection>
      <CardSection title={t('Subagents')} link={card.links.tools}>
        <AccessList items={card.subagents} empty={t('No subagents')} />
      </CardSection>
      <CardSection title={t('MCP servers')} link={card.links.tools}>
        <McpServerList servers={card.mcpServers} />
      </CardSection>
      <CardSection title={t('Memory')} link={card.links.memory}>
        <MemoryList levels={card.memory} />
      </CardSection>
      <CardSection title={t('Permissions')} link={card.links.permissions}>
        <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-sm bg-gray-3 px-2 py-1">
          {card.permissions.map((line, index) => (
            <span
              key={`${index}-${line.permission}-${line.pattern}`}
              className="font-mono text-xs text-gray-12 break-all"
            >
              {`${line.permission} ${line.pattern} → ${line.action}`}
              <span className="text-gray-11">{` (${line.level})`}</span>
            </span>
          ))}
        </div>
      </CardSection>
      <CardSection title={t('Hooks')} link={card.links.hooks}>
        {card.hooks.length === 0 ? (
          <span className="text-xs text-gray-11">{t('No hooks')}</span>
        ) : (
          card.hooks.map((hook) => (
            <span key={`${hook.level}-${hook.name}`} className="text-xs">
              <span className="text-gray-12">{hook.name}</span>
              <span className="text-gray-11">{` · ${hook.event} · ${hook.level} · ${hook.state}`}</span>
            </span>
          ))
        )}
      </CardSection>
    </div>
  );
};

export const OpencodeMcpServerList = ({
  servers,
}: {
  servers: OpencodeMcpServerView[];
}) => <McpServerList servers={servers} />;

export const OpencodeMemoryList = ({
  levels,
}: {
  levels: OpencodeMemoryLevelView[];
}) => <MemoryList levels={levels} />;

export const OpencodeItemBadges = ({
  items,
  empty,
}: {
  items: OpencodeNamedItem[];
  empty: string;
}) => (
  <BadgeList
    items={items.map((item) => ({
      key: item.name,
      label: item.name,
      title: item.description,
    }))}
    empty={empty}
  />
);

const CardSection = ({
  title,
  link,
  children,
}: {
  title: string;
  link: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-gray-11">{title}</span>
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

const BadgeList = ({
  items,
  empty,
}: {
  items: { key: string; label: string; title?: string }[];
  empty: string;
}) =>
  items.length === 0 ? (
    <span className="text-xs text-gray-11">{empty}</span>
  ) : (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge key={item.key} variant="secondary" size="sm" title={item.title}>
          {item.label}
        </Badge>
      ))}
    </div>
  );

const AccessList = ({
  items,
  empty,
}: {
  items: OpencodeNamedItem[];
  empty: string;
}) =>
  items.length === 0 ? (
    <span className="text-xs text-gray-11">{empty}</span>
  ) : (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge
          key={item.name}
          variant={ACCESS_VARIANT[item.access ?? 'ask']}
          size="sm"
          title={item.description}
        >
          {`${item.name} · ${accessLabel(item.access ?? 'ask')}`}
        </Badge>
      ))}
    </div>
  );

const McpServerList = ({ servers }: { servers: OpencodeMcpServerView[] }) =>
  servers.length === 0 ? (
    <span className="text-xs text-gray-11">{t('No MCP servers')}</span>
  ) : (
    <div className="flex flex-col gap-0.5">
      {servers.map((server) => (
        <span key={server.name} className="text-xs">
          <span className="text-gray-12">{server.name}</span>
          <span
            className={
              server.status === 'connected' ? 'text-success-11' : 'text-gray-11'
            }
          >
            {` · ${server.status}`}
          </span>
          {!isNil(server.error) && (
            <span className="text-danger-11">{` · ${server.error}`}</span>
          )}
        </span>
      ))}
    </div>
  );

const MemoryList = ({ levels }: { levels: OpencodeMemoryLevelView[] }) =>
  levels.every((level) => level.entries.length === 0) ? (
    <span className="text-xs text-gray-11">{t('No memory entries')}</span>
  ) : (
    <div className="flex flex-col gap-1">
      {levels
        .filter((level) => level.entries.length > 0)
        .map((level) => (
          <div key={level.level} className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-11">{level.level}</span>
            {level.entries.map((entry) => (
              <span key={entry.title} className="text-xs">
                <span className="text-gray-12">{entry.title}</span>
                <span className="text-gray-11">{` — ${entry.description}`}</span>
              </span>
            ))}
          </div>
        ))}
    </div>
  );

function accessLabel(access: OpencodeAccess): string {
  switch (access) {
    case 'allow':
      return t('allowed');
    case 'ask':
      return t('asks');
    case 'deny':
      return t('denied');
  }
}

const ACCESS_VARIANT: Record<
  OpencodeAccess,
  'secondary' | 'warning' | 'destructive'
> = {
  allow: 'secondary',
  ask: 'warning',
  deny: 'destructive',
};

type OpencodeAgentCardProps = {
  projectId: string;
  name: string;
  namespace?: string;
  project?: string;
};
