import { Permission } from '@activepieces/core-utils';
import {
  Template,
  TemplateType,
  UncategorizedFolderId,
} from '@activepieces/shared';
import { t } from 'i18next';
import {
  Bot,
  ChevronRight,
  Plus,
  Sparkles,
  Table2,
  Upload,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PermissionNeededTooltip } from '@/components/custom/permission-needed-tooltip';
import { TagWithBright } from '@/components/custom/tag-with-bright';
import { useEmbedding } from '@/components/providers/embed-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportFlowDialog } from '@/features/flows/components/import-flow-dialog';
import { flowHooks } from '@/features/flows/hooks/flow-hooks';
import { PieceIconList } from '@/features/pieces/components/piece-icon-list';
import { ImportTableDialog } from '@/features/tables/components/import-table-dialog';
import { tableHooks } from '@/features/tables/hooks/table-hooks';
import { TemplatesBrowseDialog } from '@/features/templates';
import { UseTemplateDialog } from '@/features/templates/components/use-template-dialog';
import { templatesHooks } from '@/features/templates/hooks/templates-hook';
import { useGradientFromPieces } from '@/features/templates/hooks/use-gradient-from-pieces';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { flagsHooks } from '@/hooks/flags-hooks';
import { platformHooks } from '@/hooks/platform-hooks';

type ActionRowProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  hasPermission?: boolean;
};

const ActionRow = ({
  icon,
  label,
  onClick,
  disabled,
  hasPermission = true,
}: ActionRowProps) => {
  const content = (
    <ActionRowButton
      icon={icon}
      label={label}
      onClick={onClick}
      disabled={disabled || !hasPermission}
    />
  );

  if (!hasPermission) {
    return (
      <PermissionNeededTooltip hasPermission={hasPermission}>
        {content}
      </PermissionNeededTooltip>
    );
  }

  return content;
};

const ActionRowButton = ({
  icon,
  label,
  onClick,
  disabled,
  ref,
  ...props
}: React.ComponentProps<'button'> & {
  icon: React.ReactNode;
  label: string;
}) => {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-full items-center gap-2 border-t border-gray-6 px-4 text-left transition-colors hover:bg-gray-3 focus-visible:bg-gray-3 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      {...props}
    >
      <span className="flex shrink-0 text-gray-11 [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-12">
        {label}
      </span>
      <ChevronRight className="size-4 shrink-0 text-gray-10" />
    </button>
  );
};

type GetStartedCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
  children: React.ReactNode;
};

const GetStartedCard = ({
  icon,
  title,
  description,
  index,
  children,
}: GetStartedCardProps) => {
  return (
    <div
      data-slot="get-started-card"
      className="group/start flex w-60 flex-col overflow-hidden rounded-lg border border-gray-6 bg-panel motion-safe:animate-stagger-in motion-safe:transition-[translate,box-shadow] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_8px_25px_0_var(--cast)]"
      style={{ animationDelay: `${160 + index * 80}ms` }}
    >
      <div className="flex flex-col items-center p-4 pb-3 text-center">
        <span className="flex text-gray-10 transition-colors duration-300 group-hover/start:text-accent-9 [&_svg]:size-12 [&_svg]:stroke-[1.5]">
          {icon}
        </span>
        <h3 className="mt-3 text-sm font-medium text-gray-12">{title}</h3>
        <p className="mt-1 text-xs text-gray-10">{description}</p>
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
};

type SuggestedTemplateCardProps = {
  template: Template;
  onSelect: (template: Template) => void;
};

const SuggestedTemplateCard = ({
  template,
  onSelect,
}: SuggestedTemplateCardProps) => {
  const hasFlows = template.flows && template.flows.length > 0;
  const { gradient } = useGradientFromPieces(
    hasFlows ? template.flows![0]?.trigger : undefined,
  );

  const displayTags = template.tags.slice(0, 1);

  return (
    <Card
      onClick={() => onSelect(template)}
      variant="interactive"
      className="h-[220px] flex flex-col"
    >
      <CardContent className="py-4 px-4 flex flex-col gap-1 flex-1 min-h-0">
        <div className="h-12 flex flex-col justify-start flex-shrink-0">
          <h3 className="font-semibold text-base leading-tight line-clamp-2">
            {template.name}
          </h3>
        </div>

        <p className="text-gray-11 text-sm line-clamp-2 mt-1 flex-shrink-0">
          {template.summary || (
            <span className="italic">{t('No summary')}</span>
          )}
        </p>

        <div className="h-8 flex gap-2 flex-wrap overflow-hidden mt-2 flex-shrink-0">
          {displayTags.length > 0 &&
            displayTags.map((tag, index) => (
              <TagWithBright
                key={index}
                index={index}
                prefix={t('Save')}
                title={tag.title}
                color={tag.color}
                size="sm"
              />
            ))}
        </div>
      </CardContent>

      <div
        className="h-14 flex items-center px-4 rounded-b-lg transition-all duration-300"
        style={{
          background: gradient || 'rgba(0,0,0,0.02)',
        }}
      >
        {hasFlows && template.flows![0]?.trigger && (
          <PieceIconList
            trigger={template.flows![0]?.trigger}
            maxNumberOfIconsToShow={4}
            size="md"
            className="flex gap-0.5"
            excludeCore={true}
          />
        )}
      </div>
    </Card>
  );
};

const TemplateCardSkeleton = () => {
  return (
    <Card className="h-[220px] flex flex-col">
      <CardContent className="py-4 px-4 flex flex-col gap-2 flex-1">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-6 w-24 mt-2" />
      </CardContent>
      <div className="h-14 bg-gray-3/30 rounded-b-lg" />
    </Card>
  );
};

type AutomationsEmptyStateProps = {
  onRefresh: () => void;
  agentsVisible: boolean;
  userHasPermissionToWriteAgent: boolean;
  isCreatingAgent: boolean;
  onCreateAgent: () => void;
};

export const AutomationsEmptyState = ({
  onRefresh,
  agentsVisible,
  userHasPermissionToWriteAgent,
  isCreatingAgent,
  onCreateAgent,
}: AutomationsEmptyStateProps) => {
  const navigate = useNavigate();
  const { embedState } = useEmbedding();
  const [isImportTableDialogOpen, setIsImportTableDialogOpen] = useState(false);
  const [isTemplatesBrowseDialogOpen, setIsTemplatesBrowseDialogOpen] =
    useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [useTemplateDialogOpen, setUseTemplateDialogOpen] = useState(false);

  const { checkAccess } = useAuthorization();
  const userHasPermissionToWriteFlow = checkAccess(Permission.WRITE_FLOW);
  const userHasPermissionToWriteTable = checkAccess(Permission.WRITE_TABLE);

  const { platform } = platformHooks.useCurrentPlatform();
  const isShowingOfficialTemplates = !platform.plan.manageTemplatesEnabled;

  const { templates, isLoading: isLoadingTemplates } =
    templatesHooks.useTemplates(
      isShowingOfficialTemplates ? TemplateType.OFFICIAL : TemplateType.CUSTOM,
    );

  const { mutate: createFlow, isPending: isCreateFlowPending } =
    flowHooks.useStartFromScratch(UncategorizedFolderId);

  const { mutate: createTable, isPending: isCreateTablePending } =
    tableHooks.useCreateTable(UncategorizedFolderId);

  const handleTemplateSelect = (template: Template) => {
    if (embedState.isEmbedded) {
      setSelectedTemplate(template);
      setUseTemplateDialogOpen(true);
    } else {
      navigate(`/templates/${template.id}`);
    }
  };

  const handleViewAllTemplates = () => {
    if (embedState.isEmbedded) {
      setIsTemplatesBrowseDialogOpen(true);
    } else {
      navigate('/templates');
    }
  };

  const topTemplates = templates?.slice(0, 3) || [];
  const hasTemplates = topTemplates.length > 0;
  const branding = flagsHooks.useWebsiteBranding();

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12">
      <div className="flex w-full flex-col items-center">
        <h2 className="mb-4 text-center text-xl font-semibold text-gray-12 motion-safe:animate-heading-rise">
          {t('Get started with {brandName}', {
            brandName: branding.websiteName ?? platform.name,
          })}
        </h2>
        <div className="flex flex-wrap justify-center gap-5 md:gap-6">
          <GetStartedCard
            index={0}
            icon={<Workflow />}
            title={t('Build a Flow')}
            description={t('Create automated workflows')}
          >
            <ActionRow
              icon={<Plus />}
              label={t('Start from scratch')}
              onClick={() => createFlow()}
              disabled={isCreateFlowPending}
              hasPermission={userHasPermissionToWriteFlow}
            />
            <PermissionNeededTooltip
              hasPermission={userHasPermissionToWriteFlow}
            >
              <ImportFlowDialog
                insideBuilder={false}
                onRefresh={onRefresh}
                folderId={UncategorizedFolderId}
              >
                <ActionRowButton
                  icon={<Upload />}
                  label={t('Import')}
                  disabled={!userHasPermissionToWriteFlow}
                />
              </ImportFlowDialog>
            </PermissionNeededTooltip>
            <ActionRow
              icon={<Sparkles />}
              label={t('Use Templates')}
              onClick={() => {
                if (embedState.isEmbedded) {
                  setIsTemplatesBrowseDialogOpen(true);
                } else {
                  navigate('/templates');
                }
              }}
              hasPermission={userHasPermissionToWriteFlow}
            />
          </GetStartedCard>

          {!embedState.hideTables && (
            <GetStartedCard
              index={1}
              icon={<Table2 />}
              title={t('Create a Table')}
              description={t('Organize and manage data')}
            >
              <ActionRow
                icon={<Plus />}
                label={t('Start from scratch')}
                onClick={() => createTable({ name: t('New Table') })}
                disabled={isCreateTablePending}
                hasPermission={userHasPermissionToWriteTable}
              />
              <ActionRow
                icon={<Upload />}
                label={t('Import')}
                onClick={() => setIsImportTableDialogOpen(true)}
                hasPermission={userHasPermissionToWriteTable}
              />
            </GetStartedCard>
          )}

          {agentsVisible && (
            <GetStartedCard
              index={embedState.hideTables ? 1 : 2}
              icon={<Bot />}
              title={t('Build an Agent')}
              description={t('Delegate tasks to AI')}
            >
              <ActionRow
                icon={<Plus />}
                label={t('Start from scratch')}
                onClick={onCreateAgent}
                disabled={isCreatingAgent}
                hasPermission={userHasPermissionToWriteAgent}
              />
            </GetStartedCard>
          )}
        </div>
      </div>

      {(hasTemplates || isLoadingTemplates) && (
        <div className="mt-12 w-full">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium text-gray-11">
              {t('Templates For You')}
              <Sparkles className="size-4 text-swatch-6-mark" />
            </h2>
            <button
              type="button"
              onClick={handleViewAllTemplates}
              className="flex items-center gap-1 text-sm text-gray-10 transition-colors hover:text-gray-12"
            >
              {t('All templates')}
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {isLoadingTemplates ? (
              <>
                <TemplateCardSkeleton />
                <TemplateCardSkeleton />
                <TemplateCardSkeleton />
              </>
            ) : (
              topTemplates.map((template) => (
                <SuggestedTemplateCard
                  key={template.id}
                  template={template}
                  onSelect={handleTemplateSelect}
                />
              ))
            )}
          </div>
        </div>
      )}

      {!embedState.hideTables && (
        <ImportTableDialog
          open={isImportTableDialogOpen}
          setIsOpen={setIsImportTableDialogOpen}
          showTrigger={false}
        />
      )}
      <TemplatesBrowseDialog
        open={isTemplatesBrowseDialogOpen}
        onOpenChange={setIsTemplatesBrowseDialogOpen}
      />
      {selectedTemplate && (
        <UseTemplateDialog
          key={selectedTemplate.id}
          template={selectedTemplate}
          open={useTemplateDialogOpen}
          onOpenChange={(isOpen) => {
            setUseTemplateDialogOpen(isOpen);
            if (!isOpen) setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
};
