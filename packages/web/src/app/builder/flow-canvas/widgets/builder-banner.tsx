import { isNil } from '@activepieces/core-utils';

import { ResourceLockWidget } from '@/components/custom/resource-lock-widget';

import { useBuilderStateContext } from '../../builder-hooks';

import { FlowApprovalBanner } from './flow-approval-banner';
import { ViewingOldVersionWidget } from './viewing-old-version-widget';

const BuilderBanner = ({ lockedBy, takeOver }: BuilderBannerProps) => {
  const run = useBuilderStateContext((state) => state.run);

  if (lockedBy) {
    return (
      <ResourceLockWidget
        lockedBy={lockedBy}
        takeOver={takeOver}
        resourceLabel="flow"
      />
    );
  }
  if (!isNil(run)) {
    return null;
  }
  return (
    <>
      <FlowApprovalBanner />
      <ViewingOldVersionWidget />
    </>
  );
};

BuilderBanner.displayName = 'BuilderBanner';
export { BuilderBanner };

type BuilderBannerProps = {
  lockedBy: React.ComponentProps<typeof ResourceLockWidget>['lockedBy'] | null;
  takeOver: () => void;
};
