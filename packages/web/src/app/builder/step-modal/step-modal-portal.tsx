import { createContext, useContext } from 'react';

const StepModalPortalContext = createContext<HTMLElement | null>(null);

function useStepModalPortalContainer(): HTMLElement | null {
  return useContext(StepModalPortalContext);
}

export { StepModalPortalContext, useStepModalPortalContainer };
