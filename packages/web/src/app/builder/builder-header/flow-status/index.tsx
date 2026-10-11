import { isNil } from '@activepieces/core-utils';
import { FlowVersionState } from '@activepieces/shared';
import React from 'react';

import { useBuilderStateContext } from '@/app/builder/builder-hooks';
import { FlowStatusToggle } from '@/features/flows';

const BuilderFlowStatusSection = React.memo(() => {
  const [flowVersion, flow] = useBuilderStateContext((state) => [
    state.flowVersion,
    state.flow,
  ]);
  const isPublishedVersionOpen = flow.publishedVersionId === flowVersion.id;
  const isDraftOfPublishedFlow =
    flowVersion.state === FlowVersionState.DRAFT &&
    !isNil(flow.publishedVersionId);
  if (!isPublishedVersionOpen && !isDraftOfPublishedFlow) {
    return null;
  }
  return <FlowStatusToggle flow={flow} />;
});

BuilderFlowStatusSection.displayName = 'BuilderFlowStatusSection';
export { BuilderFlowStatusSection };
