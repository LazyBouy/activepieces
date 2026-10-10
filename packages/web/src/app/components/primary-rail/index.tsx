import { Permission } from '@activepieces/core-utils';
import {
  ApEdition,
  ApFlagId,
  isNil,
  PlatformRole,
  PROJECT_COLOR_PALETTE,
  ProjectType,
  ProjectWithLimits,
  TemplateTelemetryEventType,
} from '@activepieces/shared';
import { useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import {
  Bot,
  ChartLine,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Compass,
  Lock,
  LogOut,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  SquarePen,
  Unplug,
  UserCogIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLatest } from 'react-use';

import { Shortcut } from '@/components/custom/shortcut';
import { TextWithTooltip } from '@/components/custom/text-with-tooltip';
import { UserAvatar } from '@/components/custom/user-avatar';
import { useEmbedding } from '@/components/providers/embed-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAgentsNavVisible } from '@/features/agents';
import { CreateNewMenu } from '@/features/automations/components/create-new-menu';
import { useAutomationsCreate } from '@/features/automations/hooks/use-automations-create';
import { SidebarUsageLimits } from '@/features/billing';
import { chatUtils } from '@/features/chat/lib/chat-utils';
import {
  CreateProjectButton,
  getProjectName,
  PlatformSwitcher,
  projectCollectionUtils,
} from '@/features/projects';
import { templatesTelemetryApi } from '@/features/templates';
import {
  railIsCollapsed,
  railPreferences,
  railShortcut,
  railSizing,
  useRailCollapsed,
} from '@/features/workspace/lib/rail-collapsed';
import {
  useAuthorization,
  useIsPlatformAdmin,
} from '@/hooks/authorization-hooks';
import { flagsHooks } from '@/hooks/flags-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import { useScrollEdges } from '@/hooks/use-scroll-edges';
import { userHooks } from '@/hooks/user-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { cn } from '@/lib/utils';

import { AccountSettingsDialog } from '../account-settings';
import { recordAccess } from '../global-search/access-history';
import { useGlobalSearch } from '../global-search/global-search-context';
import { HelpAndFeedbackItems } from '../help-and-feedback';
import { mcpHooks } from '../project-settings/mcp-server/utils/mcp-hooks';

export function PrimaryRail() {
  const { embedState } = useEmbedding();
  const { platform } = platformHooks.useCurrentPlatform();
  const { data: currentUser } = userHooks.useCurrentUser();
  const { preference, width, setCollapsed, setWidth, saveWidth } =
    useRailCollapsed();
  const { pathname } = useLocation();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const collapsed = railIsCollapsed({ preference, pathname, openedOn });
  const showAgents = useAgentsNavVisible();
  const isRailHidden = embedState.isEmbedded || embedState.hideSideNav;
  const { reachesMcp } = mcpHooks.useMcpReach({ enabled: !isRailHidden });

  const setRailCollapsed = (next: boolean) => {
    setOpenedOn(pathname);
    setCollapsed(next);
  };
  const toggleRef = useLatest(() => setRailCollapsed(!collapsed));

  useEffect(() => {
    if (isRailHidden) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const shouldToggle = railShortcut.isToggleShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        defaultPrevented: event.defaultPrevented,
        target: event.target instanceof HTMLElement ? event.target : null,
        dialogOpen: document.querySelector(OPEN_DIALOG_SELECTOR) !== null,
      });
      if (shouldToggle) {
        event.preventDefault();
        toggleRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRailHidden, toggleRef]);

  if (isRailHidden) {
    return null;
  }

  const resizeTo = (pointerX: number) => {
    const railLeft = railRef.current?.getBoundingClientRect().left ?? 0;
    const result = railSizing.resolveDrag({ pointerX, railLeft });
    if (result.width === null) {
      if (!collapsed) {
        setRailCollapsed(true);
      }
      return;
    }
    if (collapsed) {
      setRailCollapsed(false);
    }
    setWidth(result.width);
  };

  const finishResize = () => {
    if (!isResizing) {
      return;
    }
    setIsResizing(false);
    saveWidth();
  };

  const cursor = railSizing.resizeCursor({ collapsed, width });

  return (
    <div
      ref={railRef}
      data-collapsed={collapsed}
      className={cn(
        'relative z-30 flex h-svh shrink-0 transition-[width] duration-200 ease-cubic-out motion-reduce:transition-none',
        isResizing && 'transition-none',
      )}
      style={{ width: collapsed ? railSizing.collapsedWidth : width }}
    >
      <div className="flex h-full w-full flex-col overflow-hidden border-r border-gray-6 bg-panel whitespace-nowrap">
        <RailHeader
          collapsed={collapsed}
          onToggle={() => setRailCollapsed(!collapsed)}
        />

        <RailScrollArea collapsed={collapsed}>
          <div
            className={cn(
              'flex shrink-0 flex-col gap-0.5 px-1.5 py-2',
              collapsed && 'border-b border-gray-6',
            )}
          >
            {platform.plan.chatEnabled && (
              <RailNavLink
                collapsed={collapsed}
                to="/chat"
                icon={<SquarePen />}
                label={t('Chat')}
                active={pathname.startsWith('/chat')}
                onClick={() =>
                  window.dispatchEvent(new Event(chatUtils.newChatEvent))
                }
              />
            )}
            {reachesMcp && (
              <RailNavLink
                collapsed={collapsed}
                to="/mcp-server"
                icon={<Unplug />}
                label={t('MCP')}
                active={pathname.startsWith('/mcp-server')}
              />
            )}
            {showAgents && (
              <RailNavLink
                collapsed={collapsed}
                to="/agents"
                icon={<Bot />}
                label={t('Agents')}
                active={pathname.startsWith('/agents')}
              />
            )}
            <RailNavLink
              collapsed={collapsed}
              to="/templates"
              icon={<Compass />}
              label={t('Explore')}
              active={pathname.startsWith('/templates')}
              onClick={() =>
                templatesTelemetryApi.sendEvent({
                  eventType: TemplateTelemetryEventType.EXPLORE_VIEW,
                  userId: currentUser?.id,
                })
              }
            />
            <RailNavLink
              collapsed={collapsed}
              to="/impact"
              icon={<ChartLine />}
              label={t('Impact')}
              active={pathname.startsWith('/impact')}
            />
          </div>
          <RailPinnedProjects collapsed={collapsed} />
        </RailScrollArea>

        {!collapsed && (
          <div className="shrink-0 px-1.5 pb-1.5 empty:hidden">
            <SidebarUsageLimits />
          </div>
        )}
        <RailBottomBlock collapsed={collapsed} />
      </div>

      <div
        aria-hidden="true"
        data-resizing={isResizing}
        className="group/resize absolute inset-y-0 right-0 z-10 w-1 translate-x-1/2 touch-none"
        style={{ cursor }}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setIsResizing(true);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
            return;
          }
          resizeTo(event.clientX);
        }}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
        onLostPointerCapture={finishResize}
      >
        <div className="absolute inset-y-0 left-1/2 hidden w-1.5 -translate-x-1/2 bg-gray-7 group-hover/resize:block group-data-[resizing=true]/resize:block" />
      </div>
      {isResizing && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-80 select-none"
          style={{ cursor }}
        />
      )}
    </div>
  );
}

function RailHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const branding = flagsHooks.useWebsiteBranding();
  const { setOpen: setSearchOpen } = useGlobalSearch();
  const { embedState } = useEmbedding();
  const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);
  const { platform: currentPlatform } = platformHooks.useCurrentPlatform();
  const showSwitcher = edition === ApEdition.CLOUD && !embedState.isEmbedded;
  const tooltipSide = collapsed ? 'right' : 'bottom';

  const actions = (
    <>
      <RailCreateMenu collapsed={collapsed} />
      <RailIconButton
        label={t('Search')}
        tooltipSide={tooltipSide}
        shortcut={<Shortcut shortcutKey="k" withCtrl variant="chip" />}
        onClick={() => setSearchOpen(true)}
      >
        <Search />
      </RailIconButton>
      <RailIconButton
        label={collapsed ? t('Open sidebar') : t('Close sidebar')}
        tooltipSide={tooltipSide}
        shortcut={<Shortcut shortcutKey={railShortcut.key} variant="chip" />}
        onClick={onToggle}
      >
        <PanelLeft />
      </RailIconButton>
    </>
  );

  if (collapsed) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-1 border-b border-gray-6 px-1.5 py-2">
        {actions}
      </div>
    );
  }

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 px-1.5 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Tooltip delayDuration={RAIL_TOOLTIP_DELAY}>
          <TooltipTrigger asChild>
            <Link
              to="/"
              className="flex size-5 shrink-0 items-center justify-center rounded-sm outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus-halo"
            >
              <img
                src={branding.logos.logoIconUrl}
                alt={branding.websiteName}
                className="size-5 shrink-0"
                draggable={false}
              />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">{branding.websiteName}</TooltipContent>
        </Tooltip>

        {showSwitcher ? (
          <PlatformSwitcher>
            <button
              type="button"
              className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-sm px-1.5 text-left text-sm font-medium text-gray-12 outline-hidden hover:bg-gray-3 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus-halo data-[state=open]:bg-gray-3"
            >
              <span className="min-w-0 flex-1 truncate">
                {currentPlatform?.name ?? t('platform')}
              </span>
              <ChevronsUpDown className="size-3 shrink-0 text-gray-10" />
            </button>
          </PlatformSwitcher>
        ) : (
          <TextWithTooltip tooltipMessage={branding.websiteName}>
            <span className="min-w-0 flex-1 text-sm font-medium text-gray-12">
              {branding.websiteName}
            </span>
          </TextWithTooltip>
        )}
      </div>

      <div className="flex shrink-0 items-center">{actions}</div>
    </div>
  );
}

function RailIconButton({
  label,
  tooltipSide,
  shortcut,
  children,
  ...buttonProps
}: RailIconButtonProps) {
  return (
    <Tooltip delayDuration={RAIL_TOOLTIP_DELAY}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={RAIL_ICON_BUTTON_CLASS}
          {...buttonProps}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        <span className="flex items-center gap-1.5">
          {label}
          {shortcut}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function RailCreateMenu({ collapsed }: { collapsed: boolean }) {
  const { embedState } = useEmbedding();
  const { checkAccess } = useAuthorization();
  const { platform } = platformHooks.useCurrentPlatform();
  const { data: currentUser } = userHooks.useCurrentUser();
  const { data: projects } = projectCollectionUtils.useAll();
  const showAgents = useAgentsNavVisible();
  const navigate = useNavigate();
  const creation = useAutomationsCreate();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  const projectId = authenticationSession.getProjectId();
  const hasProject = !isNil(projectId) && projectId !== '';
  const canCreateFlow = hasProject && checkAccess(Permission.WRITE_FLOW);
  const canCreateTable =
    hasProject && !embedState.hideTables && checkAccess(Permission.WRITE_TABLE);
  const canCreateAgent =
    hasProject && showAgents && checkAccess(Permission.WRITE_AGENT);
  const canCreateProject =
    platform.plan.billedTeamProjectsLimit !== 0 &&
    currentUser?.platformRole === PlatformRole.ADMIN;
  const hasProjectItems = canCreateFlow || canCreateTable || canCreateAgent;

  if (embedState.isEmbedded || (!hasProjectItems && !canCreateProject)) {
    return null;
  }

  return (
    <>
      <Tooltip delayDuration={RAIL_TOOLTIP_DELAY}>
        <CreateNewMenu
          scope="root"
          align="start"
          side={collapsed ? 'right' : 'bottom'}
          contentClassName="w-auto min-w-50"
          hideItemsWithoutPermission
          userHasPermissionToWriteFlow={canCreateFlow}
          userHasPermissionToWriteTable={canCreateTable}
          userHasPermissionToWriteFolder={false}
          userHasPermissionToWriteAgent={canCreateAgent}
          isCreatingFlow={creation.isCreateFlowPending}
          isCreatingTable={creation.isCreatingTable}
          isCreatingAgent={creation.isCreatingAgent}
          onCreateFlow={() => creation.createFlow()}
          onCreateTable={() => creation.createTable(t('New Table'))}
          onCreateAgent={
            canCreateAgent ? () => creation.createAgent() : undefined
          }
          footer={
            canCreateProject && (
              <>
                {hasProjectItems && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={() => setProjectDialogOpen(true)}>
                  <Plus className="size-4" />
                  {t('New Project')}
                </DropdownMenuItem>
              </>
            )
          }
        >
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('Create')}
              className={RAIL_ICON_BUTTON_CLASS}
            >
              <Plus />
            </Button>
          </TooltipTrigger>
        </CreateNewMenu>
        <TooltipContent side={collapsed ? 'right' : 'bottom'}>
          {t('Create')}
        </TooltipContent>
      </Tooltip>
      {canCreateProject && (
        <CreateProjectButton
          variant="dialog"
          projects={projects ?? []}
          open={projectDialogOpen}
          onOpenChange={setProjectDialogOpen}
          onCreate={(project) =>
            navigate(`/projects/${project.id}/automations`)
          }
        />
      )}
    </>
  );
}

function RailScrollArea({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { overflowing, atStart } = useScrollEdges({
    ref: scrollRef,
    axis: 'y',
  });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div className="flex flex-col">{children}</div>
      </div>
      {!collapsed && !atStart && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gray-6"
        />
      )}
      {!collapsed && overflowing && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gray-6"
        />
      )}
    </div>
  );
}

function RailNavLink({
  collapsed,
  to,
  icon,
  label,
  active,
  onClick,
}: {
  collapsed: boolean;
  to: string;
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <RailTooltip collapsed={collapsed} label={label}>
      <Link
        to={to}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
        className={railItemClassName({ collapsed, active })}
      >
        <RailItemContent
          collapsed={collapsed}
          icon={icon}
          label={label}
          active={active}
        />
      </Link>
    </RailTooltip>
  );
}

function RailTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactElement;
}) {
  if (!collapsed) {
    return children;
  }
  return (
    <Tooltip delayDuration={RAIL_TOOLTIP_DELAY}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function RailItemContent({
  collapsed,
  icon,
  label,
  active,
  trailing,
}: {
  collapsed: boolean;
  icon: ReactNode;
  label: string;
  active: boolean;
  trailing?: ReactNode;
}) {
  return (
    <>
      <span
        className={cn(
          'relative flex size-6 shrink-0 items-center justify-center text-gray-11 group-hover/rail-item:text-gray-12 group-data-[state=open]/rail-item:text-gray-12 [&>svg]:size-4',
          active && 'text-gray-12',
        )}
      >
        {icon}
      </span>
      {!collapsed && (
        <TextWithTooltip tooltipMessage={label}>
          <span className="min-w-0 flex-1 text-left leading-4.5">{label}</span>
        </TextWithTooltip>
      )}
      {!collapsed && trailing}
    </>
  );
}

function RailPinnedProjects({ collapsed }: { collapsed: boolean }) {
  const { data: projects } = projectCollectionUtils.useAll();
  const { platform } = platformHooks.useCurrentPlatform();
  const { data: currentUser } = userHooks.useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const showCreateProject =
    platform.plan.billedTeamProjectsLimit !== 0 &&
    currentUser?.platformRole === PlatformRole.ADMIN;
  const [sort, setSort] = useState<PinnedSort>(() =>
    readStoredSort(railPreferences.readPinnedSort()),
  );
  const [listCollapsed, setListCollapsed] = useState(() =>
    railPreferences.readProjectsCollapsed(),
  );
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const changeSort = (next: PinnedSort) => {
    setSort(next);
    railPreferences.writePinnedSort(next);
  };

  const toggleList = () => {
    const next = !listCollapsed;
    setListCollapsed(next);
    railPreferences.writeProjectsCollapsed(next);
  };

  if (projects.length === 0) {
    return null;
  }

  const ordered = orderProjects({
    projects,
    sort,
  });

  const openProject = ({
    projectId,
    name,
  }: {
    projectId: string;
    name: string;
  }) => {
    recordAccess({
      id: `project-${projectId}`,
      type: 'project',
      label: name,
      href: `/projects/${projectId}/automations`,
    });
    if (projectId !== authenticationSession.getProjectId()) {
      authenticationSession.switchToProject(projectId);
    }
    navigate(`/projects/${projectId}/automations`);
  };

  const showRows = collapsed || !listCollapsed;

  return (
    <div className="flex shrink-0 flex-col">
      {!collapsed && (
        <div className="group/projects mx-1.5 mt-1 flex items-center gap-1 rounded-sm hover:bg-gray-3">
          <button
            type="button"
            aria-expanded={!listCollapsed}
            aria-controls={PROJECT_LIST_ID}
            onClick={toggleList}
            className="flex min-w-0 flex-1 items-center gap-1 rounded-sm px-1.5 py-1 text-left text-xs font-medium text-gray-11 outline-hidden group-hover/projects:text-gray-12 focus-visible:outline-1 focus-visible:outline-solid focus-visible:-outline-offset-1 focus-visible:outline-focus"
          >
            <span className="truncate">{t('Projects')}</span>
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 text-gray-10 transition-transform duration-150 ease-standard group-hover/projects:text-gray-12 motion-reduce:transition-none',
                listCollapsed && '-rotate-90',
              )}
            />
          </button>
          <div
            className={cn(
              'flex shrink-0 items-center gap-0.5 pr-1 opacity-0 group-focus-within/projects:opacity-100 group-hover/projects:opacity-100',
              sortMenuOpen && 'opacity-100',
            )}
          >
            {showCreateProject && (
              <CreateProjectButton
                variant="icon"
                projects={projects ?? []}
                className={RAIL_SECTION_ACTION_CLASS}
                onCreate={(project) => {
                  navigate(`/projects/${project.id}/automations`);
                }}
              />
            )}
            <PinnedSortMenu
              sort={sort}
              onChange={changeSort}
              onOpenChange={setSortMenuOpen}
            />
          </div>
        </div>
      )}
      {showRows && (
        <div id={PROJECT_LIST_ID} className="flex flex-col gap-0.5 px-1.5 py-2">
          {ordered.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              collapsed={collapsed}
              animateLayout={!prefersReducedMotion}
              active={location.pathname.includes(`/projects/${project.id}`)}
              onOpen={openProject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  collapsed,
  animateLayout,
  active,
  onOpen,
}: {
  project: ProjectWithLimits;
  collapsed: boolean;
  animateLayout: boolean;
  active: boolean;
  onOpen: (params: { projectId: string; name: string }) => void;
}) {
  const name = getProjectName(project);
  const isTeam = project.type === ProjectType.TEAM;
  const palette =
    isTeam && project.icon ? PROJECT_COLOR_PALETTE[project.icon.color] : null;

  const badge = (
    <span
      className="flex size-4.5 shrink-0 items-center justify-center rounded-sm text-xss font-semibold leading-none"
      style={
        palette
          ? { backgroundColor: palette.color, color: palette.textColor }
          : undefined
      }
    >
      {isTeam ? (
        name.charAt(0).toUpperCase()
      ) : (
        <Lock className="size-3 text-gray-10" />
      )}
    </span>
  );

  return (
    <RailTooltip collapsed={collapsed} label={name}>
      <motion.button
        layout={animateLayout}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        type="button"
        onClick={() => onOpen({ projectId: project.id, name })}
        aria-label={name}
        aria-current={active ? 'page' : undefined}
        className={railItemClassName({ collapsed, active })}
      >
        <RailItemContent
          collapsed={collapsed}
          icon={badge}
          label={name}
          active={active}
        />
      </motion.button>
    </RailTooltip>
  );
}

function PinnedSortMenu({
  sort,
  onChange,
  onOpenChange,
}: {
  sort: PinnedSort;
  onChange: (next: PinnedSort) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        aria-label={t('Sort pinned projects')}
        className={cn(
          RAIL_SECTION_ACTION_CLASS,
          'flex items-center justify-center data-[state=open]:bg-gray-4',
        )}
      >
        <SlidersHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-48">
        <PinnedMenuOption
          label={t('Recently added')}
          active={sort === 'added'}
          onClick={() => onChange('added')}
        />
        <PinnedMenuOption
          label={t('Recently used')}
          active={sort === 'recency'}
          onClick={() => onChange('recency')}
        />
        <PinnedMenuOption
          label={t('Alphabetical')}
          active={sort === 'alphabetical'}
          onClick={() => onChange('alphabetical')}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PinnedMenuOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onClick} className="justify-between">
      {label}
      {active && <Check className="size-4 text-accent-9" />}
    </DropdownMenuItem>
  );
}

function RailBottomBlock({ collapsed }: { collapsed: boolean }) {
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const showPlatformAdmin = useIsPlatformAdmin();
  const { embedState } = useEmbedding();
  const { pathname } = useLocation();

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-0.5 p-1.5',
        collapsed && 'border-t border-gray-6',
      )}
    >
      {showPlatformAdmin && !embedState.isEmbedded && (
        <RailNavLink
          collapsed={collapsed}
          to="/platform/projects"
          icon={<Shield />}
          label={t('Platform Admin')}
          active={pathname.startsWith('/platform')}
        />
      )}
      {!embedState.isEmbedded && (
        <RailPopoverItem
          collapsed={collapsed}
          icon={<CircleHelp />}
          label={t('Help & Feedback')}
        >
          <HelpAndFeedbackItems />
        </RailPopoverItem>
      )}
      <RailTooltip collapsed={collapsed} label={t('Settings')}>
        <button
          type="button"
          aria-label={t('Settings')}
          onClick={() => setAccountSettingsOpen(true)}
          className={railItemClassName({ collapsed, active: false })}
        >
          <RailItemContent
            collapsed={collapsed}
            icon={<Settings />}
            label={t('Settings')}
            active={false}
          />
        </button>
      </RailTooltip>
      <RailAccountItem
        collapsed={collapsed}
        onOpenAccountSettings={() => setAccountSettingsOpen(true)}
      />
      <AccountSettingsDialog
        open={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
      />
    </div>
  );
}

function RailPopoverItem({
  collapsed,
  icon,
  label,
  triggerLabel,
  children,
}: {
  collapsed: boolean;
  icon: ReactNode;
  label: string;
  triggerLabel?: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu modal>
      <RailTooltip collapsed={collapsed} label={triggerLabel ?? label}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={triggerLabel ?? label}
            className={railItemClassName({ collapsed, active: false })}
          >
            <RailItemContent
              collapsed={collapsed}
              icon={icon}
              label={label}
              active={false}
              trailing={
                <ChevronRight className="ml-auto size-4 shrink-0 text-gray-10" />
              }
            />
          </button>
        </DropdownMenuTrigger>
      </RailTooltip>
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={RAIL_POPOVER_OFFSET}
        className="min-w-65"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RailAccountItem({
  collapsed,
  onOpenAccountSettings,
}: {
  collapsed: boolean;
  onOpenAccountSettings: () => void;
}) {
  const { data: user } = userHooks.useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const fullName = user.firstName + ' ' + user.lastName;

  const handleLogout = () => {
    userHooks.invalidateCurrentUser(queryClient);
    authenticationSession.logOut();
    navigate('/sign-in');
  };

  return (
    <RailPopoverItem
      collapsed={collapsed}
      label={fullName}
      triggerLabel={t('Account')}
      icon={
        <span className="size-5 shrink-0 overflow-hidden rounded-full">
          <UserAvatar
            className={cn('size-full object-cover', {
              'scale-150': isNil(user.imageUrl),
            })}
            name={fullName}
            email={user.email}
            imageUrl={user.imageUrl}
            size={20}
            disableTooltip={true}
          />
        </span>
      }
    >
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex items-center gap-2 px-2 py-1.5 text-left">
          <div className="size-8 shrink-0 overflow-hidden rounded-full">
            <UserAvatar
              className="size-full object-cover"
              name={fullName}
              email={user.email}
              imageUrl={user.imageUrl}
              size={32}
              disableTooltip={true}
            />
          </div>
          <div className="grid min-w-0 flex-1 text-left">
            <span className="truncate text-sm font-medium text-gray-12">
              {fullName}
            </span>
            <span className="truncate text-xs text-gray-11">{user.email}</span>
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onOpenAccountSettings}>
        <UserCogIcon className="size-4" />
        {t('Account Settings')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={handleLogout}>
        <LogOut className="size-4" />
        {t('Log out')}
      </DropdownMenuItem>
    </RailPopoverItem>
  );
}

function railItemClassName({
  collapsed,
  active,
}: {
  collapsed: boolean;
  active: boolean;
}) {
  return cn(
    'group/rail-item flex min-h-8 w-full shrink-0 cursor-pointer items-center gap-1 rounded-sm p-1 text-left text-sm font-normal text-gray-12 outline-hidden hover:bg-gray-3 focus-visible:outline-1 focus-visible:outline-solid focus-visible:-outline-offset-1 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-gray-8 data-[state=open]:bg-gray-3',
    collapsed && 'justify-center',
    active && 'bg-gray-3',
  );
}

function readStoredSort(stored: string | null): PinnedSort {
  return PINNED_SORTS.find((sort) => sort === stored) ?? 'added';
}

function lastFlowUpdatedAt(project: ProjectWithLimits): number {
  const lastFlowUpdated = project.analytics.lastFlowUpdated;
  if (isNil(lastFlowUpdated)) {
    return 0;
  }
  return new Date(lastFlowUpdated).getTime();
}

function compareProjects({ sort }: { sort: PinnedSort }) {
  return (a: ProjectWithLimits, b: ProjectWithLimits): number => {
    if (sort === 'alphabetical') {
      return getProjectName(a).localeCompare(getProjectName(b));
    }
    if (sort === 'added') {
      return new Date(b.created).getTime() - new Date(a.created).getTime();
    }
    const flowA = lastFlowUpdatedAt(a);
    const flowB = lastFlowUpdatedAt(b);
    if (flowA !== flowB) {
      return flowB - flowA;
    }
    return new Date(b.updated).getTime() - new Date(a.updated).getTime();
  };
}

function orderProjects({
  projects,
  sort,
}: {
  projects: ProjectWithLimits[];
  sort: PinnedSort;
}): ProjectWithLimits[] {
  const compare = compareProjects({ sort });
  const personal = projects.filter(
    (project) => project.type !== ProjectType.TEAM,
  );
  const others = projects.filter(
    (project) => project.type === ProjectType.TEAM,
  );
  return [...personal.sort(compare), ...others.sort(compare)];
}

const RAIL_TOOLTIP_DELAY = 500;

const RAIL_POPOVER_OFFSET = 19;

const OPEN_DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]';

const PROJECT_LIST_ID = 'primary-rail-projects';

const RAIL_ICON_BUTTON_CLASS =
  'text-gray-11 hover:bg-gray-3 hover:text-gray-12 pressed:bg-gray-4 [&_svg]:size-4';

const RAIL_SECTION_ACTION_CLASS =
  'size-5 rounded-sm text-gray-10 hover:bg-gray-4 hover:text-gray-12 [&_svg]:size-3.5!';

const PINNED_SORTS = ['added', 'recency', 'alphabetical'] as const;

type PinnedSort = (typeof PINNED_SORTS)[number];

type RailIconButtonProps = React.ComponentProps<typeof Button> & {
  label: string;
  tooltipSide: 'right' | 'bottom';
  shortcut?: ReactNode;
};
