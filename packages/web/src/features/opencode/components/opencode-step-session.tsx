import { isNil } from '@activepieces/core-utils';
import {
  OpencodeStepSessionView,
  OpencodeTranscriptEntry,
} from '@activepieces/shared';
import { t } from 'i18next';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatUtils } from '@/lib/format-utils';

import { opencodeViewsQueries } from '../hooks/opencode-views-hooks';

export const OpencodeStepSessions = ({
  flowRunId,
  flowVersionId,
  stepName,
  enabled,
}: OpencodeStepSessionsProps) => {
  const { data: sessions } = opencodeViewsQueries.useStepSessions({
    flowRunId,
    flowVersionId,
    stepName,
    enabled,
  });
  if (isNil(sessions) || sessions.length === 0) {
    return null;
  }
  const shown = isNil(flowRunId) ? sessions.slice(0, 1) : sessions;
  return (
    <div
      className="flex flex-col gap-2 px-3 py-2"
      data-testid="opencode-step-sessions"
    >
      {shown.map((session) => (
        <OpencodeSessionPanel key={session.stepId} session={session} />
      ))}
    </div>
  );
};

export const OpencodeSessionPanel = ({
  session,
}: {
  session: OpencodeStepSessionView;
}) => {
  const details = [
    session.model,
    isNil(session.agent) ? null : t('agent {agent}', { agent: session.agent }),
    isNil(session.namespace) || isNil(session.project)
      ? null
      : `${session.namespace}/${session.project}`,
  ].filter((part) => !isNil(part));

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-6 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-gray-11" />
          <span className="text-sm font-semibold text-gray-12">
            {t('OpenCode session')}
          </span>
          <Badge variant={statusVariant({ session })} size="sm">
            {statusLabel({ session })}
          </Badge>
        </div>
        {!isNil(session.adminPanelUrl) && !session.sessionGone && (
          <a
            href={session.adminPanelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs text-gray-11 hover:text-gray-12"
          >
            <ExternalLink className="size-3" />
            {t('Open in admin panel')}
          </a>
        )}
      </div>
      {session.sessionGone && (
        <span className="text-xs text-warning-11">
          {t('This session was removed in the OpenCode admin panel.')}
        </span>
      )}
      {details.length > 0 && (
        <span className="text-xs text-gray-11">{details.join(' · ')}</span>
      )}
      {!isNil(session.usage) && (
        <span className="text-xs text-gray-11">
          {t(
            '{input} in · {output} out · {reasoning} reasoning tokens · cost {cost}',
            {
              input: formatUtils.formatNumber(session.usage.input),
              output: formatUtils.formatNumber(session.usage.output),
              reasoning: formatUtils.formatNumber(session.usage.reasoning),
              cost: `$${session.usage.cost.toFixed(4)}`,
            },
          )}
          {!isNil(session.durationMs) &&
            ` · ${formatUtils.formatDuration(session.durationMs)}`}
        </span>
      )}
      {!isNil(session.failure) && (
        <span className="text-xs text-danger-11">{session.failure}</span>
      )}
      <SessionFiles session={session} />
      {session.action !== RUN_AGENT && session.transcript.length > 0 && (
        <Transcript entries={session.transcript} />
      )}
    </div>
  );
};

const SessionFiles = ({ session }: { session: OpencodeStepSessionView }) => {
  if (session.files.length === 0 && session.skippedFiles.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-11">
        {t('Files the agent wrote')}
      </span>
      {session.files.map((file) => (
        <a
          key={file.url}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gray-12 hover:underline"
        >
          <FileText className="size-3 shrink-0" />
          <span className="truncate">{file.name}</span>
          <span className="shrink-0 text-gray-11">
            {formatUtils.formatStorageSize(file.size)}
          </span>
        </a>
      ))}
      {session.skippedFiles.map((file) => (
        <span key={file.name} className="text-xs text-gray-11">
          {t('{name} was not saved: {reason}', {
            name: file.name,
            reason: file.reason,
          })}
        </span>
      ))}
    </div>
  );
};

const Transcript = ({ entries }: { entries: OpencodeTranscriptEntry[] }) => {
  const [open, setOpen] = useState(false);
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
          {t('Transcript ({count})', { count: entries.length })}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 pt-1">
        {entries.map((entry, index) =>
          entry.type === 'text' ? (
            <p
              key={index}
              className="whitespace-pre-wrap break-words text-xs text-gray-12"
            >
              {entry.text}
            </p>
          ) : (
            <ToolEntry key={index} entry={entry} />
          ),
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ToolEntry = ({
  entry,
}: {
  entry: Extract<OpencodeTranscriptEntry, { type: 'tool' }>;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-sm border border-gray-6"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs"
        >
          {open ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          <span className="font-mono text-gray-12">{entry.tool}</span>
          <span className="text-gray-11">{entry.status}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-1 px-2 pb-2">
        <pre className="whitespace-pre-wrap break-all rounded-sm bg-gray-3 px-2 py-1 text-xs text-gray-12">
          {JSON.stringify(entry.input, null, 2)}
        </pre>
        {!isNil(entry.output) && (
          <pre className="whitespace-pre-wrap break-all rounded-sm bg-gray-3 px-2 py-1 text-xs text-gray-12">
            {entry.output}
          </pre>
        )}
        {!isNil(entry.error) && (
          <span className="text-xs text-danger-11">{entry.error}</span>
        )}
        {!isNil(entry.subagentUrl) && (
          <a
            href={entry.subagentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-11 hover:text-gray-12"
          >
            <ExternalLink className="size-3" />
            {t('Open the subagent session in the admin panel')}
          </a>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

function statusLabel({
  session,
}: {
  session: OpencodeStepSessionView;
}): string {
  switch (session.status) {
    case 'COMPLETED':
      return t('Finished');
    case 'FAILED':
      return t('Failed');
    case 'QUEUED':
      return t('Waiting for the session');
    case 'PENDING':
      return t('Starting');
    default:
      return t('Running');
  }
}

function statusVariant({
  session,
}: {
  session: OpencodeStepSessionView;
}): 'success' | 'destructive' | 'secondary' {
  switch (session.status) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'destructive';
    default:
      return 'secondary';
  }
}

const RUN_AGENT = 'RUN_AGENT';

type OpencodeStepSessionsProps = {
  flowRunId?: string;
  flowVersionId?: string;
  stepName: string;
  enabled: boolean;
};
