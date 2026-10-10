import { isNil } from '@activepieces/core-utils';
import { ApEdition, ApFlagId } from '@activepieces/shared';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { useEmbedding } from '@/components/providers/embed-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar-shadcn';
import { CreditsUsageAlert, ManagePlanDialog } from '@/features/billing';
import { projectHooks } from '@/features/projects';
import { flagsHooks } from '@/hooks/flags-hooks';
import {
  cn,
  DASHBOARD_PAGE_CONTAINER_CLASS,
  DASHBOARD_PAGE_CONTAINER_STYLE,
} from '@/lib/utils';

import { authenticationSession } from '../../../lib/authentication-session';
import {
  GlobalSearchProvider,
  useGlobalSearch,
} from '../global-search/global-search-context';
import { PrimaryRail } from '../primary-rail';

import { ProjectDashboardLayoutHeader } from './project-dashboard-layout-header';

const ProjectChangedRedirector = ({
  currentProjectId,
  children,
}: {
  currentProjectId: string;
  children: React.ReactNode;
}) => {
  projectHooks.useReloadPageIfProjectIdChanged(currentProjectId);
  return children;
};

export function ProjectDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);
  const currentProjectId = authenticationSession.getProjectId();
  const location = useLocation();
  const isPlatformPage = location.pathname.includes('/platform/');
  const isEmbedded = useEmbedding().embedState.isEmbedded;
  const hasNoProject = isNil(currentProjectId) || currentProjectId === '';

  const hideHeader =
    hasNoProject ||
    ROUTES_WITHOUT_HEADER.some((route) => location.pathname.includes(route)) ||
    isPlatformPage;

  const inner = (
    <GlobalSearchProvider>
      <ProjectDashboardLayoutInner
        hideHeader={hideHeader}
        isEmbedded={isEmbedded}
        currentProjectId={currentProjectId ?? ''}
      >
        {children}
      </ProjectDashboardLayoutInner>
      {edition !== ApEdition.COMMUNITY && <ManagePlanDialog />}
    </GlobalSearchProvider>
  );

  if (hasNoProject) {
    return inner;
  }

  return (
    <ProjectChangedRedirector currentProjectId={currentProjectId!}>
      {inner}
    </ProjectChangedRedirector>
  );
}

function ProjectDashboardLayoutInner({
  hideHeader,
  isEmbedded,
  currentProjectId,
  children,
}: {
  hideHeader: boolean;
  isEmbedded: boolean;
  currentProjectId: string;
  children: React.ReactNode;
}) {
  const { open: searchOpen } = useGlobalSearch();
  const { embedState } = useEmbedding();
  const showsPageHeader = !isEmbedded && !embedState.hidePageHeader;

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-1">
      {!isEmbedded && <PrimaryRail />}
      <SidebarProvider
        defaultOpen={false}
        hoverMode={!searchOpen}
        className="flex-1 min-w-0 w-auto will-change-transform"
      >
        <SidebarInset className="flex flex-col h-full overflow-hidden bg-gray-1">
          <div
            id="dashboard-content-container"
            className="relative flex flex-col h-full overflow-clip bg-gray-1"
          >
            {hideHeader ? (
              <>
                <CreditsUsageAlert />
                <div className="flex-1 overflow-auto">{children}</div>
              </>
            ) : (
              <div className="flex-1 overflow-auto">
                <div
                  className={cn(
                    DASHBOARD_PAGE_CONTAINER_CLASS,
                    !showsPageHeader && 'pt-4 md:pt-6',
                  )}
                  style={DASHBOARD_PAGE_CONTAINER_STYLE}
                >
                  <ProjectDashboardLayoutHeader
                    key={currentProjectId}
                    headerClassName="px-0"
                  />
                  <CreditsUsageAlert />
                  {children}
                </div>
              </div>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

const ROUTES_WITHOUT_HEADER = [
  '/templates',
  '/impact',
  '/chat',
  '/agents',
  '/mcp-server',
];

export type ProjectDashboardLayoutHeaderTab = {
  to: string;
  label: string;
  hasPermission: boolean;
  show: boolean;
  beta?: boolean;
  badgeCount?: number;
};
