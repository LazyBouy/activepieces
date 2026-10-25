/**
 * @vitest-environment jsdom
 */
import {
  OpencodeAgentList,
  OpencodeProjectOptions,
  OpencodeStepSettings,
} from '@activepieces/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Form } from '@/components/ui/form';
import { OpencodeStepSection } from '@/features/opencode/components/opencode-step-section';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  options: vi.fn(),
  agents: vi.fn(),
}));

vi.mock('i18next', () => ({
  t: (key: string, values?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (match, name: string) => values?.[name] ?? match),
}));

vi.mock('@/features/opencode/api/opencode-options-api', () => ({
  opencodeOptionsApi: {
    get: mocks.options,
    agents: mocks.agents,
  },
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latest: OpencodeStepSettings | undefined;

describe('OpenCode section of an AI step', () => {
  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    latest = undefined;
    vi.clearAllMocks();
  });

  it('says Run AI on OpenCode is off and shows no pickers', async () => {
    mocks.options.mockResolvedValue({
      ...OPTIONS,
      enabled: false,
      namespaces: [],
    });

    await renderSection({ opencode: undefined });

    expect(text()).toContain('Run AI on OpenCode is off');
    expect(text()).not.toContain('Namespace');
    expect(mocks.agents).not.toHaveBeenCalled();
  });

  it('offers the defaults, only allowlisted namespaces, and primary agents other than flow', async () => {
    mocks.options.mockResolvedValue(OPTIONS);
    mocks.agents.mockResolvedValue(AGENTS);

    await renderSection({ opencode: undefined });

    expect(text()).toContain('Flow default: Shared across this run');
    expect(text()).toContain('Default (iphi-flow)');
    expect(text()).toContain("This project's own");
    expect(text()).toContain('Default (flow)');
    expect(optionsOf('settings.opencode.namespace')).toEqual([
      '__default__',
      'iphi-flow',
      'work',
    ]);
    expect(optionsOf('settings.opencode.agent')).toEqual([
      '__default__',
      'reviewer',
    ]);
    expect(mocks.agents).toHaveBeenCalledWith({
      projectId: 'project-1',
      query: {},
    });
  });

  it('resets project and agent when the namespace changes, and asks for a project', async () => {
    mocks.options.mockResolvedValue(OPTIONS);
    mocks.agents.mockResolvedValue(AGENTS);
    await renderSection({
      opencode: { sessionMode: 'ONE_PER_RUN', agent: 'reviewer' },
    });

    await choose({ name: 'settings.opencode.namespace', value: 'work' });

    expect(latest).toEqual({
      sessionMode: 'ONE_PER_RUN',
      namespace: 'work',
      project: undefined,
      agent: undefined,
    });
    expect(optionsOf('settings.opencode.project')).toEqual(['w0001']);
    expect(text()).toContain('Pick a project');

    await choose({ name: 'settings.opencode.project', value: 'w0001' });

    expect(latest).toEqual({
      sessionMode: 'ONE_PER_RUN',
      namespace: 'work',
      project: 'w0001',
      agent: undefined,
    });
    expect(mocks.agents).toHaveBeenLastCalledWith({
      projectId: 'project-1',
      query: { namespace: 'work', project: 'w0001' },
    });
  });

  it('clears the field when every picker is back on its default', async () => {
    mocks.options.mockResolvedValue(OPTIONS);
    mocks.agents.mockResolvedValue(AGENTS);
    await renderSection({ opencode: { sessionMode: 'NEW_PER_STEP' } });

    await choose({
      name: 'settings.opencode.sessionMode',
      value: '__default__',
    });

    expect(latest).toBeUndefined();
  });

  it('warns when the saved project is no longer allowlisted', async () => {
    mocks.options.mockResolvedValue(OPTIONS);
    mocks.agents.mockResolvedValue({
      agents: [],
      error:
        'vault/v0001 is not allowlisted. A platform admin can add it in Platform → AI → OpenCode.',
    });

    await renderSection({ opencode: { namespace: 'vault', project: 'v0001' } });

    expect(text()).toContain('This namespace or project is not allowlisted.');
    expect(text()).toContain(
      'Could not load agents from OpenCode: vault/v0001 is not allowlisted.',
    );
    expect(optionsOf('settings.opencode.namespace')).toContain('vault');
  });
});

async function renderSection({
  opencode,
}: {
  opencode: OpencodeStepSettings | undefined;
}): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <Harness opencode={opencode} />
      </QueryClientProvider>,
    );
  });
  await flush();
}

function Harness({ opencode }: { opencode: OpencodeStepSettings | undefined }) {
  const form = useForm<HarnessForm>({
    defaultValues: { settings: { opencode } },
  });
  latest = form.watch('settings.opencode');
  return (
    <Form {...form}>
      <form>
        <OpencodeStepSection
          projectId="project-1"
          readonly={false}
          flowSessionMode="ONE_PER_RUN"
        />
      </form>
    </Form>
  );
}

async function choose({
  name,
  value,
}: {
  name: string;
  value: string;
}): Promise<void> {
  const select = nativeSelect({ name });
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function optionsOf(name: string): string[] {
  return Array.from(nativeSelect({ name }).options).map(
    (option) => option.value,
  );
}

function nativeSelect({ name }: { name: string }): HTMLSelectElement {
  const select = container!
    .querySelectorAll('select')
    .item(FIELD_ORDER.indexOf(name));
  if (select === null) {
    throw new Error(`no select for ${name}`);
  }
  return select;
}

function text(): string {
  return container?.textContent ?? '';
}

const FIELD_ORDER = [
  'settings.opencode.sessionMode',
  'settings.opencode.namespace',
  'settings.opencode.project',
  'settings.opencode.agent',
];

const OPTIONS: OpencodeProjectOptions = {
  enabled: true,
  adminPanelUrl: 'http://127.0.0.1:4444',
  namespaces: [
    {
      id: 'iphi-flow',
      name: 'iphi-flow',
      folder: '/root/opencode-home/iphi-flow',
      projects: [
        {
          id: 'p0001',
          name: 'p0001',
          folder: '/root/opencode-home/iphi-flow/p0001',
        },
      ],
    },
    {
      id: 'work',
      name: 'work',
      folder: '/root/opencode-home/work',
      projects: [
        {
          id: 'w0001',
          name: 'w0001',
          folder: '/root/opencode-home/work/w0001',
        },
      ],
    },
    {
      id: 'empty',
      name: 'empty',
      folder: '/root/opencode-home/empty',
      projects: [],
    },
  ],
  defaultLocation: { namespace: 'iphi-flow', project: 'p0001', agent: 'flow' },
};

const AGENTS: OpencodeAgentList = {
  agents: [
    { name: 'flow', mode: 'primary' },
    { name: 'reviewer', mode: 'primary', description: 'Reviews pull requests' },
  ],
};

type HarnessForm = {
  settings: {
    opencode?: OpencodeStepSettings;
  };
};
