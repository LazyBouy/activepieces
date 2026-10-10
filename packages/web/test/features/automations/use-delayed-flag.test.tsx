// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { useDelayedFlag } from '@/features/automations/hooks/use-delayed-flag';

describe('useDelayedFlag', () => {
  beforeAll(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterAll(() => vi.useRealTimers());

  it('stays off until the delay has passed', () => {
    const { result } = renderHook(() =>
      useDelayedFlag({ value: true, delayMs: 300 }),
    );
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('turns off at once when the value turns off', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDelayedFlag({ value, delayMs: 300 }),
      { initialProps: { value: true } },
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(true);

    rerender({ value: false });
    expect(result.current).toBe(false);
  });

  it('waits again when the value turns back on', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDelayedFlag({ value, delayMs: 300 }),
      { initialProps: { value: true } },
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender({ value: false });
    rerender({ value: true });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(true);
  });

  it('never turns on when the value ends before the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDelayedFlag({ value, delayMs: 300 }),
      { initialProps: { value: true } },
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: false });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);
  });
});
