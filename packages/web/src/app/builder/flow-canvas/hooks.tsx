import { Permission, isNil } from '@activepieces/core-utils';
import {
  FlowRunStatus,
  WebsocketClientEvent,
  RunEnvironment,
  isFlowRunStateTerminal,
} from '@activepieces/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { t } from 'i18next';
import { useEffect, useRef } from 'react';
import { useLocation, usePrevious } from 'react-use';
import { useDebouncedCallback } from 'use-debounce';

import { useEmbedding } from '@/components/providers/embed-provider';
import { useSocket } from '@/components/providers/socket-provider';
import { internalErrorToast } from '@/components/ui/sonner';
import { flowRunsApi, flowRunUtils } from '@/features/flow-runs';
import { flowsApi } from '@/features/flows';
import { useAuthorization } from '@/hooks/authorization-hooks';

import { useBuilderStateContext } from '../builder-hooks';
import { textMentionUtils } from '../piece-properties/text-input-with-mentions/text-input-utils';

import { flowCanvasUtils } from './utils/flow-canvas-utils';

const useSetSocketListener = (refetchPiece: () => void) => {
  const socket = useSocket();
  const [run] = useBuilderStateContext((state) => [state.run]);
  useEffect(() => {
    socket.on(WebsocketClientEvent.REFRESH_PIECE, () => {
      refetchPiece();
    });
    return () => {
      socket.removeAllListeners(WebsocketClientEvent.REFRESH_PIECE);
    };
  }, [socket.id, run?.id]);
};

const useListenToExistingRun = () => {
  const [run, setRun, flowVersion] = useBuilderStateContext((state) => [
    state.run,
    state.setRun,
    state.flowVersion,
  ]);
  const location = useLocation();
  const inRunsPage = location.pathname?.includes('/runs');
  useQuery({
    queryKey: ['refetched-run', run?.id],
    queryFn: async () => {
      if (isNil(run)) {
        return null;
      }
      const flowRun = await flowRunsApi.getPopulated(run.id);
      setRun(flowRun, flowVersion);
    },
    enabled:
      !isNil(run) &&
      run.environment === RunEnvironment.PRODUCTION &&
      !isFlowRunStateTerminal({
        status: run.status,
        ignoreInternalError: false,
      }) &&
      inRunsPage,
    refetchInterval: 5000,
  });
};

const useShowBuilderIsSavingWarningBeforeLeaving = () => {
  const {
    embedState: { isEmbedded },
  } = useEmbedding();
  const isSaving = useBuilderStateContext((state) => state.saving);
  useEffect(() => {
    if (isEmbedded) {
      return;
    }
    const message = t(
      'Leaving this page while saving will discard your changes, are you sure you want to leave?',
    );
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSaving) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    if (isSaving) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isSaving, isEmbedded]);
};

export const useSwitchToDraft = () => {
  const [flowVersion, setVersion, clearRun, setFlow] = useBuilderStateContext(
    (state) => [
      state.flowVersion,
      state.setVersion,
      state.clearRun,
      state.setFlow,
    ],
  );
  const socket = useSocket();
  const { checkAccess } = useAuthorization();
  const userHasPermissionToEditFlow = checkAccess(Permission.WRITE_FLOW);

  const { mutate: switchToDraft, isPending: isSwitchingToDraftPending } =
    useMutation({
      mutationFn: async () => {
        const flow = await flowsApi.get(flowVersion.flowId);
        return flow;
      },
      onSuccess: (flow) => {
        setFlow(flow);
        setVersion(flow.version);
        clearRun(userHasPermissionToEditFlow);
        socket.removeAllListeners(WebsocketClientEvent.UPDATE_RUN_PROGRESS);
      },
      // surface the failure instead of silently keeping a stale draft, which
      // matters most on the lock take-over path where the refresh replaces a
      // full-page reload
      onError: () => internalErrorToast(),
    });
  return {
    switchToDraft,
    isSwitchingToDraftPending,
  };
};

const useIsFocusInsideListMapperModeInput = ({
  containerRef,
  setIsFocusInsideListMapperModeInput,
  isFocusInsideListMapperModeInput,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  setIsFocusInsideListMapperModeInput: (
    isFocusInsideListMapperModeInput: boolean,
  ) => void;
  isFocusInsideListMapperModeInput: boolean;
}) => {
  useEffect(() => {
    const focusInListener = () => {
      const focusedElement = document.activeElement;
      const isFocusedInside = !!containerRef.current?.contains(focusedElement);
      const isFocusedInsideDataSelector =
        !isNil(document.activeElement) &&
        document.activeElement instanceof HTMLElement &&
        textMentionUtils.isDataSelectorOrChildOfDataSelector(
          document.activeElement,
        );
      setIsFocusInsideListMapperModeInput(
        isFocusedInside ||
          (isFocusedInsideDataSelector && isFocusInsideListMapperModeInput),
      );
    };
    document.addEventListener('focusin', focusInListener);
    return () => {
      document.removeEventListener('focusin', focusInListener);
    };
  }, [setIsFocusInsideListMapperModeInput, isFocusInsideListMapperModeInput]);
};
export const useFocusOnStep = () => {
  const [currentRun, selectStep, userManuallySelectedStepDuringRun] =
    useBuilderStateContext((state) => [
      state.run,
      state.selectStepByName,
      state.userManuallySelectedStepDuringRun,
    ]);

  const previousStatus = usePrevious(currentRun?.status);
  const currentStep = flowRunUtils.findLastStepWithStatus(
    previousStatus ?? FlowRunStatus.RUNNING,
    currentRun?.steps ?? {},
  );

  const { fitView } = useReactFlow();
  const focusCurrentStep = useDebouncedCallback(() => {
    if (userManuallySelectedStepDuringRun) {
      return;
    }
    if (!isNil(currentStep)) {
      fitView(flowCanvasUtils.createFocusStepInGraphParams(currentStep));
      selectStep(currentStep, { fromAutoFocus: true });
    }
  }, 500);

  useEffect(() => {
    focusCurrentStep();
  }, [currentStep, selectStep, fitView, userManuallySelectedStepDuringRun]);
};

const useFocusStepIfOffscreen = () => {
  const { getInternalNode, getViewport, setCenter } = useReactFlow();
  return (stepName: string) => {
    const element = document.querySelector(
      `[data-testid="rf__node-${CSS.escape(stepName)}"]`,
    );
    const pane = document.querySelector('.react-flow');
    const node = getInternalNode(stepName);
    if (isNil(element) || isNil(pane) || isNil(node)) {
      return;
    }
    const nodeRect = element.getBoundingClientRect();
    const paneRect = pane.getBoundingClientRect();
    const isVisible =
      nodeRect.left >= paneRect.left &&
      nodeRect.right <= paneRect.right &&
      nodeRect.top >= paneRect.top &&
      nodeRect.bottom <= paneRect.bottom;
    if (isVisible) {
      return;
    }
    const width = node.measured.width ?? 0;
    const height = node.measured.height ?? 0;
    const params = flowCanvasUtils.createFocusStepInGraphParams(stepName);
    setCenter(
      node.internals.positionAbsolute.x + width / 2,
      node.internals.positionAbsolute.y + height / 2,
      { zoom: getViewport().zoom, duration: params.duration },
    );
  };
};

const useZoomContrast = (
  containerRef: React.RefObject<HTMLDivElement | null>,
) => {
  const reactFlowStore = useStoreApi();
  useEffect(() => {
    const appliedWeight = { current: Number.NaN };
    const apply = (zoom: number) => {
      const weight = flowCanvasUtils.getZoomContrastWeight(zoom);
      if (weight === appliedWeight.current || isNil(containerRef.current)) {
        return;
      }
      appliedWeight.current = weight;
      containerRef.current.style.setProperty(
        CANVAS_CONTRAST_PROPERTY,
        String(weight),
      );
    };
    apply(reactFlowStore.getState().transform[2]);
    return reactFlowStore.subscribe((state) => apply(state.transform[2]));
  }, [reactFlowStore, containerRef]);
};

export const useResizeCanvas = (
  containerRef: React.RefObject<HTMLDivElement | null>,
) => {
  const containerSizeRef = useRef({
    width: 0,
    height: 0,
  });
  const { getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const previousSize = containerSizeRef.current;
      containerSizeRef.current = { width, height };
      const hadSize = previousSize.width > 0 && previousSize.height > 0;
      if (!hadSize) {
        return;
      }
      const { x, y, zoom } = getViewport();
      setViewport({
        x: x + (width - previousSize.width) / 2,
        y: y + (height - previousSize.height) / 2,
        zoom,
      });
    });
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, [setViewport, getViewport]);
};

const CANVAS_CONTRAST_PROPERTY = '--canvas-contrast';

export const flowCanvasHooks = {
  useSetSocketListener,
  useShowBuilderIsSavingWarningBeforeLeaving,
  useIsFocusInsideListMapperModeInput,
  useFocusOnStep,
  useFocusStepIfOffscreen,
  useZoomContrast,
  useResizeCanvas,
  useSwitchToDraft,
  useListenToExistingRun,
};
