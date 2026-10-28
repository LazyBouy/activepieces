import { ActionContext, DropdownState, InputPropertyMap, isNil, PieceAuth, Property, StoreScope } from '@activepieces/pieces-framework';
import { opencodeServer, ServerAccess } from './server';
import { opencodeStepRun, StepContext } from './step-run';

function modelDropdown<R extends boolean>({ identity, displayName, description, required, defaultValue }: ModelDropdownParams<R>) {
  return Property.Dropdown<string, R>({
    auth: PieceAuth.None(),
    displayName,
    description,
    required,
    refreshers: [],
    defaultValue,
    options: async (_, ctx) => modelOptions({ server: ctx.server, identity }),
  });
}

async function modelOptions({ server, identity }: { server: ServerAccess; identity: VendorIdentity }): Promise<DropdownState<string>> {
  const listed = await opencodeServer.read<ProviderList>({ server, path: '/models' });
  const provider = listed.providers.find((candidate) => candidate.id === identity.provider);
  if (isNil(provider) || provider.models.length === 0) {
    return { disabled: true, options: [], placeholder: listed.error ?? connectMessage({ identity }) };
  }
  return {
    disabled: false,
    options: provider.models.map((model) => ({ label: model.name, value: model.id })),
  };
}

async function run({ context, identity, memoryKey, buildRequest }: RunParams): Promise<RunResult> {
  const storeKey = isNil(memoryKey) || memoryKey.length === 0 ? null : `${MEMORY_PREFIX}${memoryKey}`;
  const result = await opencodeStepRun.run({
    context,
    timeoutMs: opencodeStepRun.STEP_TIMEOUT_MS,
    noAnswer: opencodeStepRun.NO_ANSWER,
    buildRequest: async () => {
      const remembered = isNil(storeKey) ? null : await context.store.get<unknown>(storeKey, StoreScope.PROJECT);
      const sessionId = typeof remembered === 'string' && remembered.length > 0 ? remembered : null;
      const built = await buildRequest({ continuing: !isNil(sessionId) });
      if (isNil(built.model) || built.model.length === 0) {
        throw new Error(`Pick a model. ${connectMessage({ identity })} if the list is empty.`);
      }
      return {
        action: VENDOR_PROMPT,
        vendor: identity.vendor,
        provider: identity.provider,
        ...built,
        session: sessionOf({ storeKey, sessionId }),
      };
    },
  });
  if (result.status === 'paused') {
    return { status: 'paused' };
  }
  const answer = answerOf({ output: result.output });
  if (!isNil(storeKey) && answer.sessionId.length > 0) {
    await context.store.put(storeKey, answer.sessionId, StoreScope.PROJECT);
  }
  return { status: 'done', answer };
}

function sessionOf({ storeKey, sessionId }: { storeKey: string | null; sessionId: string | null }): Record<string, string> {
  if (isNil(storeKey)) {
    return { kind: 'STEP' };
  }
  return isNil(sessionId) ? { kind: 'NEW' } : { kind: 'MEMORY', sessionId };
}

function answerOf({ output }: { output: Record<string, unknown> }): VendorAnswer {
  const usage = recordOf({ value: output['usage'] });
  const model = recordOf({ value: output['model'] });
  return {
    answer: stringOf({ value: output['answer'] }),
    structured: output['structured'],
    reasoning: stringOf({ value: output['reasoning'] }),
    sources: listOf({ value: output['sources'] }).flatMap((entry) => {
      const source = recordOf({ value: entry });
      const url = stringOf({ value: source['url'] });
      const title = source['title'];
      return url.length === 0 ? [] : [typeof title === 'string' ? { url, title } : { url }];
    }),
    finish: typeof output['finish'] === 'string' ? output['finish'] : null,
    messageId: typeof output['messageId'] === 'string' ? output['messageId'] : null,
    sessionId: stringOf({ value: output['sessionId'] }),
    adminPanelUrl: typeof output['adminPanelUrl'] === 'string' ? output['adminPanelUrl'] : null,
    model: isNil(output['model']) ? null : { providerID: stringOf({ value: model['providerID'] }), modelID: stringOf({ value: model['modelID'] }) },
    usage: {
      input: numberOf({ value: usage['input'] }),
      output: numberOf({ value: usage['output'] }),
      reasoning: numberOf({ value: usage['reasoning'] }),
      cost: numberOf({ value: usage['cost'] }),
    },
    history: listOf({ value: output['history'] }).flatMap((entry) => historyTurnOf({ entry })),
  };
}

function historyTurnOf({ entry }: { entry: unknown }): HistoryTurn[] {
  const turn = recordOf({ value: entry });
  const text = stringOf({ value: turn['text'] });
  const role: HistoryTurn['role'] = turn['role'] === 'assistant' ? 'assistant' : 'user';
  return text.length === 0 ? [] : [{ role, text }];
}

function rolesOf({ value, allowed }: { value: unknown; allowed: Role[] }): Turn[] {
  if (isNil(value) || value === '') {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(rolesError({ allowed }));
  }
  return value.map((item: unknown) => {
    const role = typeof item === 'object' && !isNil(item) && 'role' in item ? item.role : undefined;
    const known = allowed.find((candidate) => candidate === role);
    if (isNil(known)) {
      throw new Error(rolesError({ allowed }));
    }
    const content = typeof item === 'object' && !isNil(item) && 'content' in item ? item.content : '';
    return { role: known, content: textOf({ content }) };
  });
}

function rolesError({ allowed }: { allowed: Role[] }): string {
  return `The only available roles are: [${allowed.join(', ')}]`;
}

function textOf({ content }: { content: unknown }): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .flatMap((part: unknown) => (typeof part === 'object' && !isNil(part) && 'text' in part && typeof part.text === 'string' ? [part.text] : []))
    .join('\n');
}

function promptOf({ question, before = [], after = [], notes = [] }: PromptParams): string {
  const earlier = conversationLines({ turns: before });
  const later = conversationLines({ turns: after });
  return [
    ...(earlier.length === 0 ? [] : [EARLIER, ...earlier, '']),
    question,
    ...(later.length === 0 ? [] : ['', LATER, ...later]),
    ...(notes.length === 0 ? [] : ['', ...notes]),
  ].join('\n');
}

function conversationLines({ turns }: { turns: Turn[] }): string[] {
  return turns
    .filter((turn) => turn.role !== 'system' && turn.content.trim().length > 0)
    .map((turn) => `${turn.role === 'assistant' ? 'Assistant' : 'User'}: ${turn.content}`);
}

function systemOf({ texts, turns = [] }: { texts: (string | undefined)[]; turns?: Turn[] }): string | undefined {
  const all = [...texts, ...turns.filter((turn) => turn.role === 'system').map((turn) => turn.content)]
    .flatMap((text) => (isNil(text) || text.trim().length === 0 ? [] : [text.trim()]));
  return all.length === 0 ? undefined : all.join('\n\n');
}

function optionsOf({ options }: { options: ModelOptions }): { options?: Record<string, number> } {
  const given = Object.entries(options).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]));
  return given.length === 0 ? {} : { options: Object.fromEntries(given) };
}

function thinkingVariantOf({ budget }: { budget: number | undefined | null }): string {
  return !isNil(budget) && budget > HIGH_THINKING_BUDGET ? 'max' : 'high';
}

function checkInputs({ checks }: { checks: InputCheck[] }): void {
  const problems = checks.flatMap((check) => problemsOf({ check }));
  if (problems.length > 0) {
    throw new Error(problems.join(' '));
  }
}

function problemsOf({ check }: { check: InputCheck }): string[] {
  const { label, value, min, max, maxLength, integer } = check;
  if (isNil(value) || value === '') {
    return [];
  }
  if (typeof value === 'string') {
    return !isNil(maxLength) && value.length > maxLength ? [`${label} can be at most ${maxLength} characters.`] : [];
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return [`${label} must be a number.`];
  }
  if (integer === true && !Number.isInteger(value)) {
    return [`${label} must be a whole number.`];
  }
  if ((!isNil(min) && value < min) || (!isNil(max) && value > max)) {
    return [isNil(max) ? `${label} must be at least ${min}.` : isNil(min) ? `${label} must be at most ${max}.` : `${label} must be between ${min} and ${max}.`];
  }
  return [];
}

function unsupported({ feature, identity }: { feature: string; identity: VendorIdentity }): Error {
  return new Error(`${feature} does not run on OpenCode. Use the official ${identity.vendor} piece for this step.`);
}

function geminiResponseOf({ answer, includeThoughts }: { answer: VendorAnswer; includeThoughts: boolean }): GeminiResponse {
  const thoughts = includeThoughts && answer.reasoning.length > 0 ? [{ text: answer.reasoning, thought: true }] : [];
  return {
    modelVersion: answer.model?.modelID ?? '',
    candidates: [{ content: { role: 'model', parts: [...thoughts, { text: answer.answer }] }, finishReason: geminiFinishOf({ finish: answer.finish }), index: 0 }],
    usageMetadata: {
      promptTokenCount: answer.usage.input,
      candidatesTokenCount: answer.usage.output,
      thoughtsTokenCount: answer.usage.reasoning,
      totalTokenCount: answer.usage.input + answer.usage.output + answer.usage.reasoning,
    },
  };
}

function geminiFinishOf({ finish }: { finish: string | null }): string {
  switch (finish) {
    case 'length':
      return 'MAX_TOKENS';
    case 'content-filter':
      return 'SAFETY';
    default:
      return 'STOP';
  }
}

function connectMessage({ identity }: { identity: VendorIdentity }): string {
  return `Connect ${identity.vendor} in the OpenCode admin panel`;
}

function recordOf({ value }: { value: unknown }): Record<string, unknown> {
  return typeof value === 'object' && !isNil(value) && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
}

function listOf({ value }: { value: unknown }): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOf({ value }: { value: unknown }): string {
  return typeof value === 'string' ? value : '';
}

function numberOf({ value }: { value: unknown }): number {
  return typeof value === 'number' ? value : 0;
}

const VENDOR_PROMPT = 'OPENCODE_VENDOR_PROMPT';

const MEMORY_PREFIX = 'opencode-session:';

const EARLIER = 'Earlier in this conversation:';

const LATER = 'After that, in this conversation:';

const HIGH_THINKING_BUDGET = 16000;

export const opencodeVendor = {
  modelDropdown,
  run,
  rolesOf,
  promptOf,
  systemOf,
  optionsOf,
  thinkingVariantOf,
  checkInputs,
  unsupported,
  geminiResponseOf,
  MEMORY_PREFIX,
};

export type GeminiResponse = {
  modelVersion: string;
  candidates: { content: { role: 'model'; parts: { text: string; thought?: boolean }[] }; finishReason: string; index: number }[];
  usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; thoughtsTokenCount: number; totalTokenCount: number };
};

export type InputCheck = {
  label: string;
  value: unknown;
  min?: number;
  max?: number;
  maxLength?: number;
  integer?: boolean;
};

export type VendorIdentity = {
  vendor: string;
  provider: string;
};

export type Role = 'system' | 'user' | 'assistant';

export type Turn = {
  role: Role;
  content: string;
};

export type ModelOptions = {
  temperature?: number | null;
  topP?: number | null;
  maxOutputTokens?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  seed?: number | null;
};

export type VendorRequest = {
  model: string | undefined;
  prompt: string;
  system?: string;
  files?: { fileId: string; filename: string }[];
  outputSchema?: Record<string, unknown>;
  options?: Record<string, number>;
  variant?: string;
  withHistory?: boolean;
};

export type VendorAnswer = {
  answer: string;
  structured: unknown;
  reasoning: string;
  sources: { url: string; title?: string }[];
  finish: string | null;
  messageId: string | null;
  sessionId: string;
  adminPanelUrl: string | null;
  model: { providerID: string; modelID: string } | null;
  usage: { input: number; output: number; reasoning: number; cost: number };
  history: HistoryTurn[];
};

export type HistoryTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type VendorContext = StepContext & Pick<ActionContext<undefined, InputPropertyMap>, 'store'>;

export type RunResult = { status: 'paused' } | { status: 'done'; answer: VendorAnswer };

type ModelDropdownParams<R extends boolean> = {
  identity: VendorIdentity;
  displayName: string;
  description: string;
  required: R;
  defaultValue?: string;
};

type RunParams = {
  context: VendorContext;
  identity: VendorIdentity;
  memoryKey?: string | null;
  buildRequest: (input: { continuing: boolean }) => Promise<VendorRequest>;
};

type PromptParams = {
  question: string;
  before?: Turn[];
  after?: Turn[];
  notes?: string[];
};

type ProviderList = {
  providers: { id: string; name: string; models: { id: string; name: string }[] }[];
  error?: string;
};
