import { ActionContext, ApFile, ExecutionType, InputPropertyMap, isNil } from '@activepieces/pieces-framework';
import { opencodeServer } from './server';

async function run({ context, buildRequest, timeoutMs, noAnswer }: RunParams): Promise<StepResult> {
  if (context.executionType === ExecutionType.RESUME) {
    return answerOf({ body: context.resumePayload?.body, noAnswer });
  }
  const request = await buildRequest();
  if (!context.run.canPause) {
    return answerOf({ body: await send({ context, request }), noAnswer });
  }
  const waitpoint = await context.run.createWaitpoint({
    type: 'WEBHOOK',
    resumeDateTime: new Date(Date.now() + timeoutMs).toUTCString(),
  });
  const started = await send({ context, request, waitpointId: waitpoint.id });
  if (typeof started.failure === 'string') {
    throw new Error(started.failure);
  }
  context.run.waitForWaitpoint(waitpoint.id);
  return { status: 'paused' };
}

async function now({ context, request, noAnswer }: NowParams): Promise<StepResult> {
  return answerOf({ body: await send({ context, request }), noAnswer });
}

async function uploadFiles({ context, value }: UploadFilesParams): Promise<UploadedFile[]> {
  return Promise.all(
    filesOf({ value }).map(async (file) => {
      const uploaded = await context.files.upload({ fileName: file.filename, data: file.data });
      return { fileId: uploaded.id, filename: file.filename };
    }),
  );
}

function filesOf({ value }: { value: unknown }): ApFile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => (typeof entry === 'object' && !isNil(entry) && 'file' in entry && entry.file instanceof ApFile ? [entry.file] : []));
}

async function send({ context, request, waitpointId }: SendParams): Promise<{ output?: unknown; failure?: string }> {
  return opencodeServer.start({
    server: context.server,
    body: {
      flowId: context.flows.current.id,
      flowRunId: context.run.id,
      ...(isNil(waitpointId) ? {} : { waitpointId }),
      request,
    },
  });
}

function answerOf({ body, noAnswer }: { body: unknown; noAnswer: string }): StepResult {
  if (typeof body !== 'object' || body === null) {
    throw new Error(noAnswer);
  }
  const failure = 'failure' in body ? body.failure : undefined;
  if (typeof failure === 'string') {
    throw new Error(failure);
  }
  const output = 'output' in body ? body.output : undefined;
  if (typeof output !== 'object' || output === null) {
    throw new Error(noAnswer);
  }
  return { status: 'done', output: Object.fromEntries(Object.entries(output)) };
}

const STEP_TIMEOUT_MS = 60 * 60 * 1000;

const NO_ANSWER = 'OpenCode did not answer before the step timed out.';

export const opencodeStepRun = {
  run,
  now,
  uploadFiles,
  STEP_TIMEOUT_MS,
  NO_ANSWER,
};

export type StepContext = Pick<
  ActionContext<undefined, InputPropertyMap>,
  'server' | 'flows' | 'files' | 'run' | 'executionType'
> & { resumePayload?: { body?: unknown } };

export type StepResult =
  | { status: 'paused' }
  | { status: 'done'; output: Record<string, unknown> };

export type UploadedFile = {
  fileId: string;
  filename: string;
};

type RunParams = {
  context: StepContext;
  buildRequest: () => Promise<Record<string, unknown>>;
  timeoutMs: number;
  noAnswer: string;
};

type NowParams = {
  context: StepContext;
  request: Record<string, unknown>;
  noAnswer: string;
};

type SendParams = {
  context: StepContext;
  request: Record<string, unknown>;
  waitpointId?: string;
};

type UploadFilesParams = {
  context: StepContext;
  value: unknown;
};
