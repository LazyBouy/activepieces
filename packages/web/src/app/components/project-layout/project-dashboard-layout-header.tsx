import { isNil, Permission } from '@activepieces/core-utils';
import { t } from 'i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useEmbedding } from '@/components/providers/embed-provider';
import { Badge } from '@/components/ui/badge';
import { tabsListVariants, tabsTriggerVariants } from '@/components/ui/tabs';
import { flowApprovalsHooks } from '@/features/flow-approvals';
import { projectCollectionUtils } from '@/features/projects';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import { useScrollEdges } from '@/hooks/use-scroll-edges';
import { authenticationSession } from '@/lib/authentication-session';
import { cn } from '@/lib/utils';

import { ProjectDashboardPageHeader } from './project-dashboard-page-header';

import { ProjectDashboardLayoutHeaderTab } from '.';

export const ProjectDashboardLayoutHeader = ({
  headerClassName,
}: {
  headerClassName?: string;
}) => {
  const { project } = projectCollectionUtils.useCurrentProject();
  const { checkAccess, isFetchingProjectRole } = useAuthorization();
  const { platform } = platformHooks.useCurrentPlatform();
  const { embedState } = useEmbedding();
  const location = useLocation();
  const isEmbedded = embedState.isEmbedded;
  const { data: pendingApprovalsBadge } =
    flowApprovalsHooks.usePendingApprovalsBadge();
  const pendingCount = pendingApprovalsBadge?.data.length ?? 0;

  const tabs: ProjectDashboardLayoutHeaderTab[] = [
    {
      to: authenticationSession.appendProjectRoutePrefix('/automations'),
      label: t('Automations'),
      hasPermission: checkAccess(Permission.READ_FLOW),
      show: true,
    },
    {
      to: authenticationSession.appendProjectRoutePrefix('/runs'),
      label: t('Runs'),
      hasPermission: checkAccess(Permission.READ_RUN),
      show: true,
    },
    {
      to: authenticationSession.appendProjectRoutePrefix('/connections'),
      label: t('Connections'),
      hasPermission: checkAccess(Permission.READ_APP_CONNECTION),
      show: true,
    },
    {
      to: authenticationSession.appendProjectRoutePrefix('/variables'),
      label: t('Variables'),
      hasPermission: checkAccess(Permission.READ_VARIABLE),
      show: true,
    },
    {
      to: authenticationSession.appendProjectRoutePrefix('/releases'),
      label: t('Releases'),
      hasPermission:
        project.releasesEnabled &&
        checkAccess(Permission.READ_PROJECT_RELEASE) &&
        !isEmbedded,
      show: project.releasesEnabled,
    },
    {
      to: authenticationSession.appendProjectRoutePrefix('/approvals'),
      label: t('Pending approvals'),
      hasPermission:
        !isFetchingProjectRole &&
        checkAccess(Permission.PUBLISH_SENSITIVE_FLOW_ACCESS),
      show: !!platform.plan.environmentsEnabled && !!project.sensitive,
      badgeCount: pendingCount,
    },
  ];

  const visibleTabs = tabs.filter((tab) => tab.show && tab.hasPermission);

  return (
    <>
      {!isEmbedded && (
        <ProjectDashboardPageHeader className={headerClassName} />
      )}
      {!embedState.hideSideNav && (
        <ProjectTabsRow
          tabs={visibleTabs}
          isActive={(tab) => location.pathname.includes(tab.to)}
        />
      )}
    </>
  );
};

ProjectDashboardLayoutHeader.displayName = 'ProjectDashboardLayoutHeader';

function ProjectTabsRow({
  tabs,
  isActive,
}: {
  tabs: ProjectDashboardLayoutHeaderTab[];
  isActive: (tab: ProjectDashboardLayoutHeaderTab) => boolean;
}) {
  const scrollRef = useRef<HTMLElement>(null);
  const { overflowing, atStart, atEnd } = useScrollEdges({
    ref: scrollRef,
    axis: 'x',
  });

  const scrollByPage = (direction: 1 | -1) => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    element.scrollBy({
      left: direction * Math.round(element.clientWidth * 0.8),
      behavior: 'smooth',
    });
  };

  return (
    <div className="mt-2 mb-1.5 flex shrink-0 items-stretch">
      {overflowing && (
        <TabsScrollButton
          direction="left"
          disabled={atStart}
          onClick={() => scrollByPage(-1)}
        />
      )}
      <nav
        ref={scrollRef}
        className={cn(
          tabsListVariants({ variant: 'outline' }),
          'min-w-0 flex-1',
        )}
      >
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              data-state={active ? 'active' : 'inactive'}
              aria-current={active ? 'page' : undefined}
              className={cn(
                tabsTriggerVariants({ variant: 'outline' }),
                'leading-5 focus-visible:rounded-sm',
              )}
            >
              {tab.label}
              {tab.beta && (
                <Badge variant="secondary" size="sm">
                  {t('Beta')}
                </Badge>
              )}
              {!isNil(tab.badgeCount) && tab.badgeCount > 0 && (
                <Badge size="sm">
                  {tab.badgeCount > 10 ? '10+' : tab.badgeCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
      {overflowing && (
        <TabsScrollButton
          direction="right"
          disabled={atEnd}
          onClick={() => scrollByPage(1)}
        />
      )}
    </div>
  );
}

function TabsScrollButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === 'left' ? t('Scroll left') : t('Scroll right')}
      disabled={disabled}
      onClick={onClick}
      className="flex w-2.5 shrink-0 items-center justify-center text-gray-11 outline-hidden hover:text-gray-12 focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-gray-8"
    >
      <Icon className="size-2.5" />
    </button>
  );
}
