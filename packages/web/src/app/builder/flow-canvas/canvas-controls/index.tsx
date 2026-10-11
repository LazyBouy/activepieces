import { useReactFlow } from '@xyflow/react';
import { t } from 'i18next';
import { Maximize, WandSparkles, ZoomIn, ZoomOut } from 'lucide-react';

import { useBuilderStateContext } from '../../builder-hooks';
import { CanvasShortcuts, TIDY_UP_SHORTCUT } from '../../shortcuts';
import { flowCanvasConsts } from '../utils/consts';

import { CanvasControlButton } from './canvas-control-button';
import { useFitToView } from './use-fit-to-view';

const CanvasControls = () => {
  const { zoomIn, zoomOut } = useReactFlow();
  const fitToView = useFitToView();
  const [readonly, tidyUp] = useBuilderStateContext((state) => [
    state.readonly,
    state.tidyUp,
  ]);

  return (
    <div
      id="canvas-controls"
      {...{ [`data-${flowCanvasConsts.CANVAS_CHROME_ATTRIBUTE}`]: true }}
      className="absolute bottom-4 left-4 z-35 flex items-center rounded-md bg-panel p-0.5 shadow-xs"
    >
      <CanvasControlButton
        tooltip={t('Fit to view')}
        icon={Maximize}
        shortcut={CanvasShortcuts.FitView}
        onClick={fitToView}
      />
      <CanvasControlButton
        tooltip={t('Zoom in')}
        icon={ZoomIn}
        shortcut={CanvasShortcuts.ZoomIn}
        onClick={() => zoomIn({ duration: 0 })}
      />
      <CanvasControlButton
        tooltip={t('Zoom out')}
        icon={ZoomOut}
        shortcut={CanvasShortcuts.ZoomOut}
        onClick={() => zoomOut({ duration: 0 })}
      />
      {!readonly && (
        <CanvasControlButton
          tooltip={t('Arrange steps')}
          icon={WandSparkles}
          shortcut={TIDY_UP_SHORTCUT}
          onClick={tidyUp}
        />
      )}
    </div>
  );
};

export { CanvasControls };
