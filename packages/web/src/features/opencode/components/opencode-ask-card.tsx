import { isNil } from '@activepieces/core-utils';
import {
  AnswerOpencodeAskRequest,
  OpencodeAsk,
  OpencodeAskKind,
  OpencodeAskStatus,
  OpencodePermissionDecision,
  OpencodeQuestion,
} from '@activepieces/shared';
import { t } from 'i18next';
import {
  ExternalLink,
  Link2,
  MessageCircleQuestion,
  ShieldQuestion,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatUtils } from '@/lib/format-utils';

import {
  opencodeAsksMutations,
  opencodeAsksQueries,
} from '../hooks/opencode-asks-hooks';

export const OpencodeStepAsks = ({
  flowRunId,
  flowVersionId,
  stepName,
  enabled,
}: OpencodeStepAsksProps) => {
  const { data: asks } = opencodeAsksQueries.useAsks({
    flowRunId,
    flowVersionId,
    stepName,
    enabled,
  });
  const open = (asks ?? []).filter(
    (ask) => ask.status === OpencodeAskStatus.OPEN,
  );
  const settled = isNil(flowRunId)
    ? []
    : (asks ?? []).filter((ask) => ask.status !== OpencodeAskStatus.OPEN);
  if (open.length === 0 && settled.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2 px-3 py-2" data-testid="opencode-asks">
      {open.map((ask) => (
        <OpencodeAskCard key={ask.id} ask={ask} />
      ))}
      {settled.map((ask) => (
        <SettledAsk key={ask.id} ask={ask} />
      ))}
    </div>
  );
};

export const OpencodeAskCard = ({ ask }: { ask: OpencodeAsk }) => {
  const answer = opencodeAsksMutations.useAnswer();
  const [error, setError] = useState<string | null>(null);
  const send = (request: AnswerOpencodeAskRequest) => {
    setError(null);
    answer.mutate(
      { id: ask.id, request },
      {
        onError: (failure) =>
          setError(
            api.extractServerErrorMessage(
              failure,
              t('Could not send the answer'),
            ),
          ),
      },
    );
  };
  return (
    <div className="flex flex-col gap-3 rounded-md border border-warning-7 bg-warning-2 p-3">
      <div className="flex items-start gap-2">
        {ask.kind === OpencodeAskKind.PERMISSION ? (
          <ShieldQuestion className="size-4 shrink-0 text-warning-11" />
        ) : (
          <MessageCircleQuestion className="size-4 shrink-0 text-warning-11" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-semibold text-gray-12">
            {ask.kind === OpencodeAskKind.PERMISSION
              ? t('The agent asks for permission')
              : t('The agent has a question')}
          </span>
          <span className="text-xs text-gray-11">
            {t('Asked by {agent} at {time}', {
              agent: ask.agent,
              time: formatUtils.formatDateTime(new Date(ask.created)),
            })}
          </span>
          <span className="text-xs text-gray-11">
            {t('Fails at {deadline} if nobody answers', {
              deadline: formatUtils.formatDateTime(new Date(ask.deadline)),
            })}
          </span>
        </div>
      </div>
      {ask.kind === OpencodeAskKind.PERMISSION ? (
        <PermissionBody
          ask={ask}
          pending={answer.isPending}
          onAnswer={(decision, note) =>
            send({
              type: 'permission',
              decision,
              ...(note.length === 0 ? {} : { note }),
            })
          }
        />
      ) : (
        <QuestionBody
          questions={ask.questions ?? []}
          pending={answer.isPending}
          onAnswer={(answers) => send({ type: 'question', answers })}
          onDismiss={() => send({ type: 'dismiss' })}
        />
      )}
      {!isNil(error) && <span className="text-xs text-danger-11">{error}</span>}
      <AskLinks ask={ask} />
    </div>
  );
};

const PermissionBody = ({
  ask,
  pending,
  onAnswer,
}: {
  ask: OpencodeAsk;
  pending: boolean;
  onAnswer: (decision: OpencodePermissionDecision, note: string) => void;
}) => {
  const [note, setNote] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-11">{t('Tool')}</span>
        <code className="rounded-sm bg-gray-3 px-2 py-1 text-xs text-gray-12">
          {ask.permission?.permission}
        </code>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-11">{t('What it wants to do')}</span>
        <pre className="whitespace-pre-wrap break-all rounded-sm bg-gray-3 px-2 py-1 text-xs text-gray-12">
          {(ask.permission?.patterns ?? []).join('\n')}
        </pre>
      </div>
      <Textarea
        aria-label={t('Reason (sent to the agent if you deny)')}
        placeholder={t('Reason (sent to the agent if you deny)')}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="min-h-14 text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={pending}
          onClick={() => onAnswer(OpencodePermissionDecision.ALLOW_ONCE, '')}
        >
          {t('Allow once')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => onAnswer(OpencodePermissionDecision.ALLOW_RUN, '')}
        >
          {t('Allow for this run')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => onAnswer(OpencodePermissionDecision.ALLOW_AGENT, '')}
        >
          {t('Allow for this agent')}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => onAnswer(OpencodePermissionDecision.DENY, note.trim())}
        >
          {t('Deny')}
        </Button>
      </div>
    </div>
  );
};

const QuestionBody = ({
  questions,
  pending,
  onAnswer,
  onDismiss,
}: {
  questions: OpencodeQuestion[];
  pending: boolean;
  onAnswer: (answers: string[][]) => void;
  onDismiss: () => void;
}) => {
  const [picked, setPicked] = useState<string[][]>(questions.map(() => []));
  const [typed, setTyped] = useState<string[]>(questions.map(() => ''));
  const answers = questions.map((_question, index) => [
    ...(picked[index] ?? []),
    ...((typed[index] ?? '').trim().length > 0
      ? [(typed[index] ?? '').trim()]
      : []),
  ]);
  const complete = answers.every((answer) => answer.length > 0);
  return (
    <div className="flex flex-col gap-3">
      {questions.map((question, index) => (
        <div key={index} className="flex flex-col gap-2">
          <span className="text-xs text-gray-11">{question.header}</span>
          <span className="text-sm text-gray-12">{question.question}</span>
          {question.multiple === true ? (
            question.options.map((option) => (
              <Label key={option.label} className="flex items-center gap-2">
                <Checkbox
                  checked={(picked[index] ?? []).includes(option.label)}
                  onCheckedChange={(checked) =>
                    setPicked(
                      picked.map((current, position) =>
                        position !== index
                          ? current
                          : checked === true
                          ? [...current, option.label]
                          : current.filter((label) => label !== option.label),
                      ),
                    )
                  }
                />
                <span className="text-xs">{option.label}</span>
              </Label>
            ))
          ) : (
            <RadioGroup
              value={picked[index]?.[0] ?? ''}
              onValueChange={(value) =>
                setPicked(
                  picked.map((current, position) =>
                    position === index ? [value] : current,
                  ),
                )
              }
            >
              {question.options.map((option) => (
                <Label key={option.label} className="flex items-center gap-2">
                  <RadioGroupItem value={option.label} />
                  <span className="text-xs">
                    {option.label}
                    {option.description.length > 0 &&
                      ` — ${option.description}`}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          )}
          {question.custom !== false && (
            <Input
              aria-label={t('Or type your own answer')}
              placeholder={t('Or type your own answer')}
              value={typed[index] ?? ''}
              onChange={(event) =>
                setTyped(
                  typed.map((current, position) =>
                    position === index ? event.target.value : current,
                  ),
                )
              }
              className="h-8 text-xs"
            />
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={pending}
          disabled={!complete}
          onClick={() => onAnswer(answers)}
        >
          {t('Answer')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={onDismiss}
        >
          {t('Dismiss')}
        </Button>
      </div>
    </div>
  );
};

const AskLinks = ({ ask }: { ask: OpencodeAsk }) => {
  const link = opencodeAsksMutations.useLink();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        loading={link.isPending}
        onClick={() =>
          link.mutate(
            { id: ask.id },
            {
              onSuccess: ({ url }) =>
                navigator.clipboard
                  .writeText(url)
                  .then(() => toast.success(t('Approval link copied')))
                  .catch(() => undefined),
            },
          )
        }
      >
        <Link2 className="size-4" />
        {t('Copy approval link')}
      </Button>
      {!isNil(ask.adminPanelUrl) && (
        <Button size="sm" variant="ghost" asChild>
          <a href={ask.adminPanelUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            {t('Open in admin panel')}
          </a>
        </Button>
      )}
    </div>
  );
};

const SettledAsk = ({ ask }: { ask: OpencodeAsk }) => {
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-6 px-3 py-2 text-xs text-gray-11">
      {ask.kind === OpencodeAskKind.PERMISSION ? (
        <ShieldQuestion className="size-4 shrink-0" />
      ) : (
        <MessageCircleQuestion className="size-4 shrink-0" />
      )}
      <span className="truncate">{settledText({ ask })}</span>
    </div>
  );
};

function settledText({ ask }: { ask: OpencodeAsk }): string {
  const subject =
    ask.kind === OpencodeAskKind.PERMISSION
      ? `${ask.permission?.permission ?? ''}: ${(
          ask.permission?.patterns ?? []
        ).join(', ')}`
      : ask.questions?.[0]?.question ?? '';
  if (ask.status === OpencodeAskStatus.EXPIRED) {
    return t('{subject} — nobody answered in time', { subject });
  }
  if (ask.answeredVia === 'opencode') {
    return t('{subject} — answered in the OpenCode admin panel', { subject });
  }
  if (ask.status === OpencodeAskStatus.CLOSED) {
    return t('{subject} — no longer waiting', { subject });
  }
  return t('{subject} — {answer}', {
    subject,
    answer: answerText({ ask }),
  });
}

function answerText({ ask }: { ask: OpencodeAsk }): string {
  switch (ask.answer?.decision) {
    case OpencodePermissionDecision.ALLOW_ONCE:
      return t('allowed once');
    case OpencodePermissionDecision.ALLOW_RUN:
      return t('allowed for this run');
    case OpencodePermissionDecision.ALLOW_AGENT:
      return t('allowed for this agent');
    case OpencodePermissionDecision.DENY:
      return t('denied');
    default:
      return ask.answer?.dismissed === true
        ? t('dismissed')
        : t('answered: {answers}', {
            answers: (ask.answer?.answers ?? [])
              .map((answer) => answer.join(', '))
              .join('; '),
          });
  }
}

type OpencodeStepAsksProps = {
  flowRunId?: string;
  flowVersionId?: string;
  stepName: string;
  enabled: boolean;
};
