/**
 * @vitest-environment jsdom
 */
/* eslint-disable testing-library/no-unnecessary-act */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMinimapVisibility } from '@/app/builder/flow-canvas/widgets/minimap';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const latest = vi.hoisted(
  (): { current: ReturnType<typeof useMinimapVisibility> | null } => ({
    current: null,
  }),
);

function Probe() {
  latest.current = useMinimapVisibility();
  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

describe('useMinimapVisibility', () => {
  afterEach(() => {
    vi.useRealTimers();
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('is hidden while the canvas is idle', () => {
    mountProbe();
    expect(latest.current?.visible).toBe(false);
  });

  it('shows on pan and hides one second after the last pan', () => {
    mountProbe();
    act(() => latest.current?.reveal());
    expect(latest.current?.visible).toBe(true);
    act(() => vi.advanceTimersByTime(600));
    act(() => latest.current?.reveal());
    act(() => vi.advanceTimersByTime(600));
    expect(latest.current?.visible).toBe(true);
    act(() => vi.advanceTimersByTime(400));
    expect(latest.current?.visible).toBe(false);
  });

  it('stays visible while hovered and restarts the timer on leave', () => {
    mountProbe();
    act(() => latest.current?.reveal());
    act(() => latest.current?.onPointerEnter());
    act(() => vi.advanceTimersByTime(5000));
    expect(latest.current?.visible).toBe(true);
    act(() => latest.current?.onPointerLeave());
    act(() => vi.advanceTimersByTime(999));
    expect(latest.current?.visible).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(latest.current?.visible).toBe(false);
  });
});

function mountProbe(): void {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const mountedRoot = root;
  act(() => mountedRoot.render(<Probe />));
}
