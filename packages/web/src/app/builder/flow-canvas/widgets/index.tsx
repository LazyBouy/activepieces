import React from 'react';

import IncompleteSettingsButton from '@/app/builder/flow-canvas/widgets/incomplete-settings-widget';
import { TestFlowWidget } from '@/app/builder/flow-canvas/widgets/test-flow-widget';

import { useBuilderStateContext } from '../../builder-hooks';
import { flowCanvasConsts } from '../utils/consts';

const CanvasTestBar = React.memo(() => {
  const [
    flowVersion,
    selectStepByName,
    readonly,
    setOpenedPieceSelectorStepNameOrAddButtonId,
  ] = useBuilderStateContext((state) => [
    state.flowVersion,
    state.selectStepByName,
    state.readonly,
    state.setOpenedPieceSelectorStepNameOrAddButtonId,
  ]);
  return (
    <div
      {...{ [`data-${flowCanvasConsts.CANVAS_CHROME_ATTRIBUTE}`]: true }}
      className="absolute right-4 bottom-4 z-10 flex items-center gap-3 @3xl:right-auto @3xl:left-1/2 @3xl:-translate-x-1/2"
    >
      <TestFlowWidget />
      {!readonly && (
        <IncompleteSettingsButton
          flowVersion={flowVersion}
          selectStepByName={selectStepByName}
          setOpenedPieceSelectorStepNameOrAddButtonId={
            setOpenedPieceSelectorStepNameOrAddButtonId
          }
        />
      )}
    </div>
  );
});

CanvasTestBar.displayName = 'CanvasTestBar';
export { CanvasTestBar };
