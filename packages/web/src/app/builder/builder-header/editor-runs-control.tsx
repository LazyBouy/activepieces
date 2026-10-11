import { isNil, Permission } from '@activepieces/core-utils';
import { t } from 'i18next';
import React from 'react';

import { RightSideBarType } from '@/app/builder/types';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { cn } from '@/lib/utils';

import { useBuilderStateContext } from '../builder-hooks';

import { useLeaveRun } from './flow-status/view-draft-or-edit-flow-button';

const EditorRunsControl = ({ className }: { className?: string }) => {
  const [rightSidebar, setRightSidebar, hasRun] = useBuilderStateContext(
    (state) => [state.rightSidebar, state.setRightSidebar, !isNil(state.run)],
  );
  const { checkAccess } = useAuthorization();
  const { leaveRun } = useLeaveRun();
  if (!checkAccess(Permission.READ_FLOW)) {
    return null;
  }
  const value =
    rightSidebar === RightSideBarType.RUNS || hasRun
      ? RUNS_VALUE
      : EDITOR_VALUE;

  const handleValueChange = (next: string) => {
    if (next === RUNS_VALUE) {
      setRightSidebar(RightSideBarType.RUNS);
      return;
    }
    if (rightSidebar === RightSideBarType.RUNS) {
      setRightSidebar(RightSideBarType.NONE);
    }
    if (hasRun) {
      leaveRun();
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const segment =
      event.target instanceof Element
        ? event.target.closest('[data-slot="segmented-control-item"]')
        : null;
    if (
      segment?.getAttribute('value') === RUNS_VALUE &&
      rightSidebar !== RightSideBarType.RUNS
    ) {
      setRightSidebar(RightSideBarType.RUNS);
    }
  };

  return (
    <SegmentedControl
      data-editor-runs-control
      value={value}
      onValueChange={handleValueChange}
      onClick={handleClick}
      className={cn('*:flex-none', className)}
      items={[
        { value: EDITOR_VALUE, label: t('Editor') },
        { value: RUNS_VALUE, label: t('Runs') },
      ]}
    />
  );
};

EditorRunsControl.displayName = 'EditorRunsControl';
export { EditorRunsControl };

const EDITOR_VALUE = 'editor';
const RUNS_VALUE = 'runs';
