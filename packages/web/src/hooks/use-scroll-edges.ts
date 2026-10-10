import { RefObject, useCallback, useEffect, useState } from 'react';

export const useScrollEdges = ({
  ref,
  axis,
}: {
  ref: RefObject<HTMLElement | null>;
  axis: ScrollAxis;
}): ScrollEdges => {
  const [edges, setEdges] = useState<ScrollEdges>(INITIAL_EDGES);

  const update = useCallback(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const next = measureEdges({ element, axis });
    setEdges((previous) => (sameEdges(previous, next) ? previous : next));
  }, [ref, axis]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    update();
    const resizeObserver = new ResizeObserver(update);
    const observeAll = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(element);
      Array.from(element.children).forEach((child) =>
        resizeObserver.observe(child),
      );
    };
    observeAll();
    const mutationObserver = new MutationObserver(() => {
      observeAll();
      update();
    });
    mutationObserver.observe(element, { childList: true });
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [ref, update]);

  return edges;
};

function measureEdges({
  element,
  axis,
}: {
  element: HTMLElement;
  axis: ScrollAxis;
}): ScrollEdges {
  const position = axis === 'x' ? element.scrollLeft : element.scrollTop;
  const visible = axis === 'x' ? element.clientWidth : element.clientHeight;
  const total = axis === 'x' ? element.scrollWidth : element.scrollHeight;
  return {
    overflowing: total - visible > 1,
    atStart: position <= 0,
    atEnd: position + visible >= total - 1,
  };
}

function sameEdges(a: ScrollEdges, b: ScrollEdges): boolean {
  return (
    a.overflowing === b.overflowing &&
    a.atStart === b.atStart &&
    a.atEnd === b.atEnd
  );
}

const INITIAL_EDGES: ScrollEdges = {
  overflowing: false,
  atStart: true,
  atEnd: true,
};

export type ScrollAxis = 'x' | 'y';

export type ScrollEdges = {
  overflowing: boolean;
  atStart: boolean;
  atEnd: boolean;
};
