import { isNil } from '@activepieces/core-utils';
import * as React from 'react';

function MenuScrollFade() {
  const fadeRef = React.useRef<HTMLSpanElement>(null);
  const [hasHiddenItems, setHasHiddenItems] = React.useState(false);

  React.useEffect(() => {
    const container = fadeRef.current?.parentElement;
    if (isNil(container)) {
      return;
    }
    const update = () =>
      setHasHiddenItems(menuScrollFadeUtils.hasHiddenItemsBelow(container));
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(container);
    Array.from(container.children).forEach((child) =>
      resizeObserver.observe(child),
    );
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(container, { childList: true, subtree: true });
    container.addEventListener('scroll', update, { passive: true });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      container.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <span
      ref={fadeRef}
      aria-hidden="true"
      data-slot="menu-scroll-fade"
      data-visible={hasHiddenItems || undefined}
      className="pointer-events-none sticky -bottom-1 z-10 -mt-4 block h-4 bg-linear-to-t from-panel to-transparent opacity-0 data-visible:opacity-100"
    />
  );
}

function hasHiddenItemsBelow(
  element: Pick<HTMLElement, 'scrollHeight' | 'clientHeight' | 'scrollTop'>,
): boolean {
  return element.scrollHeight - element.clientHeight - element.scrollTop > 1;
}

export const menuScrollFadeUtils = { hasHiddenItemsBelow };

export { MenuScrollFade };
