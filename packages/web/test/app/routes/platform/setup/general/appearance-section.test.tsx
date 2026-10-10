/**
 * @vitest-environment jsdom
 */
/* eslint-disable testing-library/no-unnecessary-act */
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  customAppearanceEnabled: true,
  update: vi.fn(async (_formdata: FormData, _platformId: string) => undefined),
  toastSuccess: vi.fn(),
  invalidate: vi.fn(async (_filters: unknown) => undefined),
  saving: Promise.resolve() as Promise<unknown>,
}));

vi.mock('i18next', () => ({
  t: (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: { success: state.toastSuccess },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
  useMutation: (options: MutationOptions) => ({
    mutate: () => {
      state.saving = options.mutationFn().then(
        (data: unknown) => options.onSuccess(data),
        (error: unknown) => options.onError(error),
      );
    },
    isPending: false,
  }),
}));

vi.mock('@/api/platforms-api', () => ({
  platformApi: {
    updateWithFormData: (formdata: FormData, platformId: string) =>
      state.update(formdata, platformId),
  },
}));

vi.mock('@/hooks/platform-hooks', () => ({
  platformHooks: {
    useCurrentPlatform: () => ({
      platform: {
        id: 'platform-1',
        name: 'Northwind',
        primaryColor: '#0ea5e9',
        themeColors: { status: { danger: '#b91c1c' } },
        fullLogoUrl: '',
        logoIconUrl: '',
        favIconUrl: '',
        plan: { customAppearanceEnabled: state.customAppearanceEnabled },
      },
    }),
  },
}));

vi.mock('@/hooks/flags-hooks', () => ({
  flagsHooks: {
    queryKey: ['flags'],
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, disabled, onClick }: ButtonMockProps) => (
    <button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => {
  const Input = React.forwardRef<HTMLInputElement, InputMockProps>(
    ({ defaultFileName: _defaultFileName, ...props }, ref) => (
      <input ref={ref} {...props} />
    ),
  );
  Input.displayName = 'Input';
  return { Input };
});

vi.mock('@/app/components/feature-banner', () => ({
  FeatureBanner: () => null,
}));

import { AppearanceSection } from '@/app/routes/platform/setup/general/appearance-section';

let container: HTMLDivElement;
let root: Root;

async function render() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<AppearanceSection />);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function setInputValue({
  input,
  value,
}: {
  input: HTMLInputElement;
  value: string;
}) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function type({ selector, value }: { selector: string; value: string }) {
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`no input ${selector}`);
  await act(async () => {
    setInputValue({ input, value });
  });
}

async function save() {
  const button = container.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  if (!button) throw new Error('no save button');
  expect(button.disabled).toBe(false);
  await act(async () => {
    button.click();
  });
  await act(async () => {
    await state.saving;
  });
}

function buttonNamed({ name }: { name: string }): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === name,
  );
  if (!button) throw new Error(`no ${name} button`);
  return button;
}

function hasUnsavedNotice(): boolean {
  return container.textContent?.includes('You have unsaved changes') ?? false;
}

function submitButton(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  if (!button) throw new Error('no save button');
  return button;
}

function sentFields(): Record<string, FormDataEntryValue> {
  const formdata = state.update.mock.calls[0]?.[0];
  if (!formdata) throw new Error('nothing was saved');
  return Object.fromEntries(formdata.entries());
}

describe('AppearanceSection', () => {
  beforeEach(() => {
    state.update.mockReset();
    state.update.mockResolvedValue(undefined);
    state.toastSuccess.mockClear();
    state.invalidate.mockClear();
    state.saving = Promise.resolve();
    state.customAppearanceEnabled = true;
    document.documentElement.removeAttribute('style');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('offers the name, logo, icon and favicon fields and no colour controls', async () => {
    await render();
    const inputs = [...container.querySelectorAll('input')].map(
      (input) => input.id,
    );
    expect(inputs).toEqual(['name', 'logoFile', 'iconFile', 'faviconFile']);
    expect(container.textContent?.includes('Colors')).toBe(false);
    expect(
      [...container.querySelectorAll('button')].map(
        (button) => button.textContent,
      ),
    ).toEqual(['Cancel', 'Save']);
  });

  it('saves a name change without sending any colour', async () => {
    await render();
    await type({ selector: '#name', value: 'Contoso' });
    await save();
    const fields = sentFields();
    expect(fields.name).toBe('Contoso');
    expect(fields).not.toHaveProperty('primaryColor');
    expect(fields).not.toHaveProperty('themeColors');
  });

  it('leaves the page palette alone while editing', async () => {
    await render();
    await type({ selector: '#name', value: 'Contoso' });
    expect(document.documentElement.style.length).toBe(0);
  });

  it('disables saving and says nothing while there are no changes', async () => {
    await render();
    expect(submitButton().disabled).toBe(true);
    expect(buttonNamed({ name: 'Cancel' }).disabled).toBe(true);
    expect(hasUnsavedNotice()).toBe(false);
  });

  it('says there are unsaved changes once something changes, and clears it on cancel', async () => {
    await render();
    await type({ selector: '#name', value: 'Contoso' });
    expect(hasUnsavedNotice()).toBe(true);
    expect(submitButton().disabled).toBe(false);
    await act(async () => {
      buttonNamed({ name: 'Cancel' }).click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(hasUnsavedNotice()).toBe(false);
    expect(submitButton().disabled).toBe(true);
  });

  it('refreshes the platform and branding after saving instead of reloading the page', async () => {
    await render();
    await type({ selector: '#name', value: 'Contoso' });
    await save();
    expect(state.invalidate.mock.calls.map(([filters]) => filters)).toEqual([
      { queryKey: ['platform', 'platform-1'] },
      { queryKey: ['flags'] },
    ]);
    expect(state.toastSuccess).toHaveBeenCalled();
  });

  it('lets the admin retry after a failed save', async () => {
    state.update.mockRejectedValueOnce(new Error('network down'));
    await render();
    await type({ selector: '#name', value: 'Contoso' });
    await save();
    expect(submitButton().disabled).toBe(false);
    await save();
    expect(state.update).toHaveBeenCalledTimes(2);
    expect(state.toastSuccess).toHaveBeenCalled();
  });

  it('reports a failed save in place instead of confirming it', async () => {
    state.update.mockRejectedValueOnce(new Error('network down'));
    await render();
    await type({ selector: '#name', value: 'Contoso' });
    await save();
    expect(state.toastSuccess).not.toHaveBeenCalled();
    expect(
      container.textContent?.includes(
        'Failed to save changes. Please try again.',
      ),
    ).toBe(true);
  });
});

type MutationOptions = {
  mutationFn: () => Promise<unknown>;
  onSuccess: (data: unknown) => void;
  onError: (error: unknown) => void;
};

type ButtonMockProps = {
  children?: React.ReactNode;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
};

type InputMockProps = React.InputHTMLAttributes<HTMLInputElement> & {
  defaultFileName?: string;
};
