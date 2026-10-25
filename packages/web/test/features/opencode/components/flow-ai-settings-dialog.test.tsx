/**
 * @vitest-environment jsdom
 */
import { OpencodeDefaults } from '@activepieces/shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FlowAiSettingsDialog } from '@/features/opencode/components/flow-ai-settings-dialog';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('i18next', () => ({ t: (key: string) => key }));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

describe('AI settings dialog of a flow', () => {
  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('starts from a new session per step when the flow has no default, and saves the choice', async () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    await renderDialog({ defaults: {}, readonly: false, onSave, onOpenChange });

    expect(sessionSelect().value).toBe('NEW_PER_STEP');
    expect(bodyText()).toContain('Each AI step starts a new OpenCode session.');

    await act(async () => {
      sessionSelect().value = 'ONE_PER_RUN';
      sessionSelect().dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      buttonNamed('Save').click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onSave).toHaveBeenCalledWith({ sessionMode: 'ONE_PER_RUN' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the saved default and offers no save button when the version is read-only', async () => {
    await renderDialog({
      defaults: { sessionMode: 'ONE_PER_RUN' },
      readonly: true,
      onSave: vi.fn(),
      onOpenChange: vi.fn(),
    });

    expect(sessionSelect().value).toBe('ONE_PER_RUN');
    expect(sessionSelect().disabled).toBe(true);
    expect(buttons().map((button) => button.textContent)).not.toContain('Save');
  });
});

async function renderDialog({
  defaults,
  readonly,
  onSave,
  onOpenChange,
}: {
  defaults: OpencodeDefaults;
  readonly: boolean;
  onSave: (defaults: OpencodeDefaults) => void;
  onOpenChange: (open: boolean) => void;
}): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <FlowAiSettingsDialog
        open={true}
        onOpenChange={onOpenChange}
        defaults={defaults}
        readonly={readonly}
        onSave={onSave}
      />,
    );
  });
}

function sessionSelect(): HTMLSelectElement {
  const select = document.body.querySelector('select');
  if (select === null) {
    throw new Error('no session select');
  }
  return select;
}

function bodyText(): string {
  return document.body.textContent ?? '';
}

function buttons(): HTMLButtonElement[] {
  return Array.from(document.body.querySelectorAll('button'));
}

function buttonNamed(name: string): HTMLButtonElement {
  const button = buttons().find((candidate) => candidate.textContent === name);
  if (button === undefined) {
    throw new Error(`no button named ${name}`);
  }
  return button;
}
