import { useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

import { flowCanvasConsts } from '../utils/consts';

const useFitToView = () => {
  const { fitView } = useReactFlow();
  return useCallback(() => {
    fitView({ ...flowCanvasConsts.FIT_VIEW_OPTIONS, duration: 0 });
  }, [fitView]);
};

export { useFitToView };
