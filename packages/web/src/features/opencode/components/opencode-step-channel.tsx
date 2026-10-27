import { isNil } from '@activepieces/core-utils';
import { OpencodeChannelView } from '@activepieces/shared';
import { t } from 'i18next';
import { ExternalLink, MessagesSquare } from 'lucide-react';

import { TextWithTooltip } from '@/components/custom/text-with-tooltip';
import { Badge } from '@/components/ui/badge';
import { formatUtils } from '@/lib/format-utils';

import { opencodeViewsQueries } from '../hooks/opencode-views-hooks';

export const OpencodeStepChannels = ({
  flowRunId,
  flowVersionId,
  stepName,
  enabled,
  live,
}: OpencodeStepChannelsProps) => {
  const { data: channels } = opencodeViewsQueries.useStepChannels({
    flowRunId,
    flowVersionId,
    stepName,
    enabled,
    live,
  });
  if (isNil(channels) || channels.length === 0) {
    return null;
  }
  const shown = isNil(flowRunId) ? channels.slice(0, 1) : channels;
  return (
    <div
      className="flex flex-col gap-2 px-3 py-2"
      data-testid="opencode-step-channels"
    >
      {shown.map((channel) => (
        <OpencodeChannelPanel key={channel.id} channel={channel} />
      ))}
    </div>
  );
};

export const OpencodeChannelPanel = ({
  channel,
}: {
  channel: OpencodeChannelView;
}) => {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-6 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <MessagesSquare className="size-4 shrink-0 text-gray-11" />
        <span className="text-sm font-semibold text-gray-12">
          {t('Agent channel')}
        </span>
        <Badge
          variant={channel.status === 'OPEN' ? 'secondary' : 'success'}
          size="sm"
        >
          {channel.status === 'OPEN' ? t('Open') : t('Closed')}
        </Badge>
      </div>
      <TextWithTooltip tooltipMessage={channel.correlationId}>
        <p className="truncate font-mono text-xs text-gray-11">
          {channel.correlationId}
        </p>
      </TextWithTooltip>
      {!isNil(channel.finishedBy) && (
        <span className="text-xs text-gray-11">
          {finishedByLabel({ finishedBy: channel.finishedBy })}
        </span>
      )}
      {!isNil(channel.error) && (
        <span className="text-xs text-warning-11">
          {t('Could not read the conversation from OpenCode: {reason}', {
            reason: channel.error,
          })}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-gray-11">
          {t('Participants')}
        </span>
        {channel.participants.map((participant) => (
          <div
            key={participant.key}
            className="flex min-w-0 items-center justify-between gap-2"
          >
            <span className="truncate text-xs text-gray-12">
              {`${participant.projectName} · ${participant.agent}`}
            </span>
            {!isNil(participant.adminPanelUrl) && (
              <a
                href={participant.adminPanelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 text-xs text-gray-11 hover:text-gray-12"
              >
                <ExternalLink className="size-3" />
                {t('Open in admin panel')}
              </a>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-gray-11">
          {t('Messages ({count})', { count: channel.messages.length })}
        </span>
        {channel.messages.length === 0 && (
          <span className="text-xs text-gray-11">
            {channel.status === 'OPEN'
              ? t('No messages yet.')
              : t('No messages were sent.')}
          </span>
        )}
        {channel.messages.map((message) => (
          <div
            key={message.id}
            className="flex flex-col gap-1 rounded-sm bg-gray-3 px-2 py-1"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-gray-12">
                {t('{from} to {to}', { from: message.from, to: message.to })}
              </span>
              <span className="shrink-0 text-xs text-gray-11">
                {formatUtils.formatDateWithTime(new Date(message.at), true)}
              </span>
            </div>
            <p className="whitespace-pre-wrap break-words text-xs text-gray-12">
              {message.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

function finishedByLabel({ finishedBy }: { finishedBy: string }): string {
  switch (finishedBy) {
    case 'done':
      return t('Ended when the finishing agent called finish_channel.');
    case 'max messages':
      return t('Ended at the message limit.');
    case 'timeout':
      return t('Ended at the timeout.');
    case 'run ended':
      return t('Closed when the run ended.');
    case 'step failed':
      return t('Closed because the step failed.');
    default:
      return t('Ended: {reason}', { reason: finishedBy });
  }
}

type OpencodeStepChannelsProps = {
  flowRunId?: string;
  flowVersionId?: string;
  stepName: string;
  enabled: boolean;
  live: boolean;
};
