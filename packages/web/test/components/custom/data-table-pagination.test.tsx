/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({ t: (key: string) => key }));

import { DataTablePagination } from '@/components/custom/data-table/data-table-pagination';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
});

describe('DataTablePagination', () => {
  it('renders icon-only previous and next buttons with accessible names', () => {
    render({});
    expect(button('Previous')).not.toBeNull();
    expect(button('Next')).not.toBeNull();
    expect(button('Previous')?.textContent).toBe('');
  });

  it('disables the buttons per the paging state', () => {
    render({ canPrevious: false, canNext: true });
    expect(button('Previous')?.disabled).toBe(true);
    expect(button('Next')?.disabled).toBe(false);
  });

  it('calls the paging handlers', () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render({ canPrevious: true, canNext: true, onPrevious, onNext });
    act(() => {
      button('Next')?.click();
      button('Previous')?.click();
    });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('shows the optional note before the rows-per-page label', () => {
    render({ note: 'Showing the first 1000' });
    const text = container?.textContent ?? '';
    expect(text.indexOf('Showing the first 1000')).toBeLessThan(
      text.indexOf('Rows per page'),
    );
  });
});

function button(name: string) {
  return container?.querySelector<HTMLButtonElement>(
    `button[aria-label="${name}"]`,
  );
}

function render(
  overrides: Partial<React.ComponentProps<typeof DataTablePagination>>,
) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <DataTablePagination
        pageSize={10}
        pageSizeOptions={[10, 30, 50]}
        onPageSizeChange={vi.fn()}
        canPrevious={false}
        canNext={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        {...overrides}
      />,
    );
  });
}
