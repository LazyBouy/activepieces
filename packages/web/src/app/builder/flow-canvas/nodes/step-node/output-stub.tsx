import { isNil } from '@activepieces/core-utils';
import { t } from 'i18next';

import { PieceSelector } from '@/app/builder/pieces-selector';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../../../builder-hooks';
import { flowCanvasConsts } from '../../utils/consts';
import { flowCanvasUtils } from '../../utils/flow-canvas-utils';
import { ApButtonData } from '../../utils/types';

const OutputStub = ({
  id,
  insertLocation,
  top,
  left,
  length,
  hasRunData,
  itemCount,
}: {
  id: string;
  insertLocation: ApButtonData;
  top: number;
  left: number;
  length: number;
  hasRunData: boolean;
  itemCount: number | null;
}) => {
  const [readonly, isPieceSelectorOpen] = useBuilderStateContext((state) => [
    state.readonly,
    state.openedPieceSelectorStepNameOrAddButtonId === id,
  ]);
  if (readonly && !hasRunData) {
    return null;
  }
  const lineLength = hasRunData ? flowCanvasConsts.STUB_LENGTHS.long : length;
  return (
    <div
      data-output-stub={id}
      style={{ top, left }}
      className="nodrag nopan absolute flex origin-left -translate-y-1/2 items-center motion-safe:animate-stub-in"
    >
      <div
        style={{ width: lineLength }}
        className={cn(
          'relative h-0.5 bg-canvas-edge transition-colors duration-300 ease-standard',
          { 'bg-canvas-success': hasRunData },
        )}
      >
        {!isNil(itemCount) && (
          <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-sm bg-canvas-label-backdrop px-0.5 text-xsm leading-tight whitespace-nowrap text-canvas-label">
            {t('{count, plural, =1 {1 item} other {# items}}', {
              count: itemCount,
            })}
          </span>
        )}
      </div>
      {!readonly && (
        <PieceSelector
          id={id}
          operation={flowCanvasUtils.createAddOperationFromAddButtonData(
            insertLocation,
          )}
        >
          <button
            type="button"
            data-testid="add-action-button"
            aria-label={t('Add step')}
            style={{
              width: flowCanvasConsts.STUB_BOX_SIZE,
              height: flowCanvasConsts.STUB_BOX_SIZE,
            }}
            className="group/stub flex shrink-0 cursor-pointer items-center justify-center outline-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className={cn(
                'flex size-5.5 items-center justify-center rounded-sm bg-canvas-plus text-canvas-plus-glyph transition-colors group-hover/stub:bg-canvas-plus-hover group-hover/stub:text-canvas-plus-glyph-hover group-focus-visible/stub:outline-2 group-focus-visible/stub:outline-focus-halo',
                {
                  'bg-canvas-plus-hover text-canvas-plus-glyph-hover':
                    isPieceSelectorOpen,
                },
              )}
            >
              <PlusGlyph />
            </span>
          </button>
        </PieceSelector>
      )}
    </div>
  );
};

const PlusGlyph = () => (
  <svg
    width={PLUS_GLYPH_SIZE}
    height={PLUS_GLYPH_SIZE}
    viewBox={`0 0 ${PLUS_GLYPH_SIZE} ${PLUS_GLYPH_SIZE}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    className="overflow-visible"
    aria-hidden
  >
    <path
      d={`M ${PLUS_GLYPH_SIZE / 2} 0 V ${PLUS_GLYPH_SIZE} M 0 ${
        PLUS_GLYPH_SIZE / 2
      } H ${PLUS_GLYPH_SIZE}`}
    />
  </svg>
);

const PLUS_GLYPH_SIZE = 8;

export { OutputStub };
