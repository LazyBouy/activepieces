/**
 * @vitest-environment jsdom
 */
/* eslint-disable testing-library/no-unnecessary-act */
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({ t: (key: string) => key }));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

vi.mock('motion/react', () => ({
  motion: {
    button: React.forwardRef<
      HTMLButtonElement,
      React.ComponentProps<'button'> & { layout?: boolean; transition?: object }
    >(function MotionButton(
      { layout: _layout, transition: _t, ...props },
      ref,
    ) {
      return <button ref={ref} {...props} />;
    }),
  },
  useReducedMotion: () => false,
}));

vi.mock('@/lib/route-utils', () => ({
  routesThatRequireProjectId: {
    singleAgent: '/agents/:agentId',
    singleAgentRuns: '/agents/:agentId/runs',
  },
}));

vi.mock('@/components/providers/embed-provider', () => ({
  useEmbedding: () => ({
    embedState: { isEmbedded: false, hideSideNav: false, hideTables: false },
  }),
}));

vi.mock('@/components/custom/user-avatar', () => ({
  UserAvatar: () => null,
}));

vi.mock('@/features/agents', () => ({
  useAgentsNavVisible: () => false,
}));

vi.mock('@/features/automations/components/create-new-menu', () => ({
  CreateNewMenu: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/features/automations/hooks/use-automations-create', () => ({
  useAutomationsCreate: () => ({
    createFlow: vi.fn(),
    createTable: vi.fn(),
    createAgent: vi.fn(),
    isCreateFlowPending: false,
    isCreatingTable: false,
    isCreatingAgent: false,
  }),
}));

vi.mock('@/features/billing', () => ({
  SidebarUsageLimits: () => null,
}));

vi.mock('@/features/chat/lib/chat-utils', () => ({
  chatUtils: { newChatEvent: 'new-chat' },
}));

vi.mock('@/features/projects', () => ({
  CreateProjectButton: () => null,
  getProjectName: (project: { displayName: string }) => project.displayName,
  PlatformSwitcher: ({ children }: React.PropsWithChildren) => <>{children}</>,
  projectCollectionUtils: { useAll: () => ({ data: [] }) },
}));

vi.mock('@/features/templates', () => ({
  templatesTelemetryApi: { sendEvent: vi.fn() },
}));

vi.mock('@/hooks/authorization-hooks', () => ({
  useAuthorization: () => ({ checkAccess: () => true }),
  useIsPlatformAdmin: () => false,
}));

vi.mock('@/hooks/flags-hooks', () => ({
  flagsHooks: {
    useWebsiteBranding: () => ({
      websiteName: 'Brand',
      logos: { logoIconUrl: '/logo.svg' },
    }),
    useFlag: () => ({ data: undefined }),
  },
}));

vi.mock('@/hooks/platform-hooks', () => ({
  platformHooks: {
    useCurrentPlatform: () => ({
      platform: {
        name: 'Platform',
        plan: { chatEnabled: false, billedTeamProjectsLimit: 0 },
      },
    }),
  },
}));

vi.mock('@/hooks/use-scroll-edges', () => ({
  useScrollEdges: () => ({ overflowing: false, atStart: true, atEnd: true }),
}));

vi.mock('@/hooks/user-hooks', () => ({
  userHooks: {
    useCurrentUser: () => ({ data: undefined }),
    invalidateCurrentUser: vi.fn(),
  },
}));

vi.mock('@/lib/authentication-session', () => ({
  authenticationSession: {
    getProjectId: () => '',
    switchToProject: vi.fn(),
    logOut: vi.fn(),
  },
}));

vi.mock('@/app/components/account-settings', () => ({
  AccountSettingsDialog: () => null,
}));

vi.mock('@/app/components/global-search/access-history', () => ({
  recordAccess: vi.fn(),
}));

vi.mock('@/app/components/global-search/global-search-context', () => ({
  useGlobalSearch: () => ({ setOpen: vi.fn() }),
}));

vi.mock('@/app/components/help-and-feedback', () => ({
  HelpAndFeedbackItems: () => null,
}));

vi.mock('@/app/components/project-settings/mcp-server/utils/mcp-hooks', () => ({
  mcpHooks: { useMcpReach: () => ({ reachesMcp: false }) },
}));

import { PrimaryRail } from '@/app/components/primary-rail';
import {
  railSizing,
  useRailCollapsed,
} from '@/features/workspace/lib/rail-collapsed';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TEST_TIMEOUT = 20000;

let container: HTMLDivElement;
let root: Root;
const captured = new Set<number | undefined>();

function renderRail({ path = '/' }: { path?: string } = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <PrimaryRail />
      </MemoryRouter>,
    );
  });
}

function rail(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-collapsed]');
  if (!element) {
    throw new Error('rail not rendered');
  }
  return element;
}

function railWidth(): string {
  return rail().style.getPropertyValue('width');
}

function resizeHandle(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[data-resizing]');
  if (!element) {
    throw new Error('resize handle not rendered');
  }
  return element;
}

function pointer({
  type,
  clientX,
}: {
  type: 'pointerdown' | 'pointermove' | 'pointerup';
  clientX: number;
}) {
  act(() => {
    resizeHandle().dispatchEvent(
      new MouseEvent(type, { bubbles: true, clientX, button: 0 }),
    );
  });
}

function pressToggleKey(target: EventTarget = document.body) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: '[', bubbles: true }),
    );
  });
}

function throwOnStorage() {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage disabled');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled');
  });
}

beforeEach(() => {
  useRailCollapsed.setState({
    preference: false,
    width: railSizing.defaultWidth,
  });
  captured.clear();
  HTMLElement.prototype.setPointerCapture = function setPointerCapture(
    pointerId: number,
  ) {
    captured.add(pointerId);
  };
  HTMLElement.prototype.hasPointerCapture = function hasPointerCapture(
    pointerId: number,
  ) {
    return captured.has(pointerId);
  };
  HTMLElement.prototype.releasePointerCapture = function releasePointerCapture(
    pointerId: number,
  ) {
    captured.delete(pointerId);
  };
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('PrimaryRail', () => {
  it(
    'renders expanded at 200px with the header actions',
    () => {
      renderRail();

      expect(rail().dataset.collapsed).toBe('false');
      expect(railWidth()).toBe('200px');
      expect(container.querySelector('[aria-label="Search"]')).not.toBeNull();
      expect(
        container.querySelector('[aria-label="Close sidebar"]'),
      ).not.toBeNull();
    },
    TEST_TIMEOUT,
  );

  it(
    'renders the stored width and collapsed preference',
    () => {
      useRailCollapsed.setState({ width: 320 });
      renderRail();
      expect(railWidth()).toBe('320px');

      act(() => {
        useRailCollapsed.setState({ preference: true });
      });
      expect(rail().dataset.collapsed).toBe('true');
      expect(railWidth()).toBe('42px');
      expect(
        container.querySelector('[aria-label="Open sidebar"]'),
      ).not.toBeNull();
    },
    TEST_TIMEOUT,
  );

  it(
    'collapses, expands and resizes while storage throws',
    () => {
      throwOnStorage();
      renderRail();
      expect(railWidth()).toBe('200px');

      pressToggleKey();
      expect(rail().dataset.collapsed).toBe('true');
      expect(railWidth()).toBe('42px');

      pressToggleKey();
      expect(rail().dataset.collapsed).toBe('false');

      pointer({ type: 'pointerdown', clientX: 200 });
      pointer({ type: 'pointermove', clientX: 300 });
      expect(() => pointer({ type: 'pointerup', clientX: 300 })).not.toThrow();
      expect(railWidth()).toBe('304px');
    },
    TEST_TIMEOUT,
  );

  it(
    'clamps and snaps the width while dragging the edge',
    () => {
      renderRail();

      pointer({ type: 'pointerdown', clientX: 200 });
      pointer({ type: 'pointermove', clientX: 1200 });
      expect(railWidth()).toBe('500px');

      pointer({ type: 'pointermove', clientX: 263 });
      expect(railWidth()).toBe('264px');

      pointer({ type: 'pointermove', clientX: 150 });
      expect(railWidth()).toBe('200px');

      pointer({ type: 'pointermove', clientX: 60 });
      expect(rail().dataset.collapsed).toBe('true');
      expect(railWidth()).toBe('42px');

      pointer({ type: 'pointermove', clientX: 140 });
      expect(rail().dataset.collapsed).toBe('false');
      expect(railWidth()).toBe('200px');

      pointer({ type: 'pointermove', clientX: 400 });
      pointer({ type: 'pointerup', clientX: 400 });
      expect(railWidth()).toBe('400px');
      expect(window.localStorage.getItem('primary-rail-width')).toBe('400');
    },
    TEST_TIMEOUT,
  );

  it(
    'ignores pointer moves that are not part of a drag',
    () => {
      renderRail();

      pointer({ type: 'pointermove', clientX: 400 });
      expect(railWidth()).toBe('200px');
    },
    TEST_TIMEOUT,
  );

  it(
    'toggles with [ unless focus is in a field or a dialog is open',
    () => {
      renderRail();

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      pressToggleKey(input);
      expect(rail().dataset.collapsed).toBe('false');

      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      document.body.appendChild(dialog);
      pressToggleKey();
      expect(rail().dataset.collapsed).toBe('false');
      dialog.remove();

      pressToggleKey();
      expect(rail().dataset.collapsed).toBe('true');
      expect(window.localStorage.getItem('primary-rail-collapsed')).toBe(
        'true',
      );

      pressToggleKey();
      expect(rail().dataset.collapsed).toBe('false');
    },
    TEST_TIMEOUT,
  );
});
