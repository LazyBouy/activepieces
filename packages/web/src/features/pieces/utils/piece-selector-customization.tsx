import { isNil } from '@activepieces/core-utils';
import {
  PieceSelectorConfig,
  PieceSelectorTabConfig,
} from '@activepieces/shared';
import { t } from 'i18next';
import {
  ActivityIcon,
  AppWindowIcon,
  BellIcon,
  BlocksIcon,
  BotIcon,
  BoxIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CloudIcon,
  CodeIcon,
  CompassIcon,
  CpuIcon,
  CreditCardIcon,
  DatabaseIcon,
  FileTextIcon,
  FlagIcon,
  FlameIcon,
  FolderIcon,
  GaugeIcon,
  GiftIcon,
  GlobeIcon,
  GraduationCapIcon,
  HeartIcon,
  KeyIcon,
  LayersIcon,
  LayoutGridIcon,
  LinkIcon,
  LucideIcon,
  MailIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PackageIcon,
  PuzzleIcon,
  RocketIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingCartIcon,
  ShuffleIcon,
  SparklesIcon,
  SplitIcon,
  StarIcon,
  TableIcon,
  TargetIcon,
  TerminalIcon,
  UserCheckIcon,
  UsersIcon,
  WandSparklesIcon,
  WorkflowIcon,
  WrenchIcon,
  ZapIcon,
} from 'lucide-react';
import React from 'react';

import {
  PieceSelectorCategoryType,
  PieceSelectorTabType,
} from '@/features/pieces/stores/piece-selector-tabs-provider';

const PIECE_SELECTOR_TAB_ICONS: Record<string, LucideIcon> = {
  Puzzle: PuzzleIcon,
  LayoutGrid: LayoutGridIcon,
  Sparkles: SparklesIcon,
  Wrench: WrenchIcon,
  Shuffle: ShuffleIcon,
  Split: SplitIcon,
  UserCheck: UserCheckIcon,
  CheckCircle2: CheckCircle2Icon,
  Star: StarIcon,
  Heart: HeartIcon,
  Rocket: RocketIcon,
  Zap: ZapIcon,
  Bot: BotIcon,
  WandSparkles: WandSparklesIcon,
  Globe: GlobeIcon,
  Database: DatabaseIcon,
  Box: BoxIcon,
  Briefcase: BriefcaseIcon,
  Compass: CompassIcon,
  Flag: FlagIcon,
  Folder: FolderIcon,
  Terminal: TerminalIcon,
  Activity: ActivityIcon,
  AppWindow: AppWindowIcon,
  Bell: BellIcon,
  Blocks: BlocksIcon,
  Building: BuildingIcon,
  Calendar: CalendarIcon,
  Cloud: CloudIcon,
  Code: CodeIcon,
  Cpu: CpuIcon,
  CreditCard: CreditCardIcon,
  FileText: FileTextIcon,
  Flame: FlameIcon,
  Gauge: GaugeIcon,
  Gift: GiftIcon,
  GraduationCap: GraduationCapIcon,
  Key: KeyIcon,
  Layers: LayersIcon,
  Link: LinkIcon,
  Mail: MailIcon,
  Megaphone: MegaphoneIcon,
  MessageSquare: MessageSquareIcon,
  Package: PackageIcon,
  Settings: SettingsIcon,
  Shield: ShieldIcon,
  ShoppingCart: ShoppingCartIcon,
  Table: TableIcon,
  Target: TargetIcon,
  Users: UsersIcon,
  Workflow: WorkflowIcon,
};

const getRandomIconKey = (): string => {
  const keys = Object.keys(PIECE_SELECTOR_TAB_ICONS);
  return keys[Math.floor(Math.random() * keys.length)];
};

const renderIcon = (iconKey: string | undefined): React.ReactNode | null => {
  if (!iconKey) {
    return null;
  }
  const Icon = PIECE_SELECTOR_TAB_ICONS[iconKey];
  return Icon ? <Icon className="size-5" /> : null;
};

const buildResolvedTabs = ({
  availableBuiltinTabs,
  config,
}: {
  availableBuiltinTabs: DefaultBuiltinTab[];
  config: PieceSelectorConfig | null | undefined;
}): ResolvedPieceSelectorTab[] => {
  const builtinByKey = new Map<string, DefaultBuiltinTab>(
    availableBuiltinTabs.map((tab) => [tab.value, tab]),
  );

  if (!config || config.tabs.length === 0) {
    return availableBuiltinTabs.map((tab) => ({
      key: tab.value,
      type: tab.value,
      name: tab.name,
      icon: tab.icon,
    }));
  }

  const usedBuiltins = new Set<string>();
  const resolved = config.tabs.reduce<ResolvedPieceSelectorTab[]>(
    (acc, tabConfig) => {
      if (tabConfig.kind === 'BUILTIN') {
        if (tabConfig.builtinTab) {
          usedBuiltins.add(tabConfig.builtinTab);
        }
        const builtin = tabConfig.builtinTab
          ? builtinByKey.get(tabConfig.builtinTab)
          : undefined;
        if (tabConfig.hidden || !builtin) {
          return acc;
        }
        acc.push({
          key: builtin.value,
          type: builtin.value,
          name: tabConfig.title ?? builtin.name,
          icon: renderIcon(tabConfig.icon) ?? builtin.icon,
        });
        return acc;
      }
      if (tabConfig.hidden) {
        return acc;
      }
      acc.push({
        key: tabConfig.id,
        type: PieceSelectorTabType.CUSTOM,
        customTabId: tabConfig.id,
        name: tabConfig.title ?? '',
        icon: renderIcon(tabConfig.icon) ?? <PuzzleIcon className="size-5" />,
      });
      return acc;
    },
    [],
  );

  const appendedBuiltins = availableBuiltinTabs
    .filter((tab) => !usedBuiltins.has(tab.value))
    .map((tab) => ({
      key: tab.value,
      type: tab.value,
      name: tab.name,
      icon: tab.icon,
    }));

  return [...resolved, ...appendedBuiltins];
};

const getCategoryTabs = (): DefaultBuiltinTab[] =>
  CATEGORY_TABS.map((category) => ({
    value: category.type,
    name: category.label(),
    icon: renderIcon(category.iconKey),
  }));

const getDefaultTabConfigs = (): PieceSelectorTabConfig[] =>
  CATEGORY_TABS.map((category) => ({
    id: category.builtinTab,
    kind: 'BUILTIN' as const,
    builtinTab: category.builtinTab,
    hidden: false,
  }));

const getEditableTabConfigs = (
  config: PieceSelectorConfig | null | undefined,
): PieceSelectorTabConfig[] => {
  const savedTabs = (config?.tabs ?? []).filter(
    (tab) => tab.kind === 'CUSTOM' || !isNil(getCategoryTab(tab.builtinTab)),
  );
  if (savedTabs.length === 0) {
    return getDefaultTabConfigs();
  }
  const missingCategories = getDefaultTabConfigs().filter(
    (defaultTab) =>
      !savedTabs.some(
        (tab) =>
          tab.kind === 'BUILTIN' && tab.builtinTab === defaultTab.builtinTab,
      ),
  );
  return [...savedTabs, ...missingCategories];
};

const getBuiltinTabDisplay = (
  builtinTab: string | undefined,
): { defaultLabel: string; defaultIconKey: string } | undefined => {
  const category = getCategoryTab(builtinTab);
  return isNil(category)
    ? undefined
    : { defaultLabel: category.label(), defaultIconKey: category.iconKey };
};

const isCategoryTabType = (
  type: PieceSelectorTabType,
): type is PieceSelectorCategoryType =>
  CATEGORY_TABS.some((category) => category.type === type);

const getCategoryTab = (
  builtinTab: string | undefined,
): CategoryTab | undefined =>
  CATEGORY_TABS.find((category) => category.builtinTab === builtinTab);

const getCustomTab = ({
  config,
  customTabId,
}: {
  config: PieceSelectorConfig | null | undefined;
  customTabId: string | null;
}): PieceSelectorTabConfig | null => {
  if (!config || !customTabId) {
    return null;
  }
  return (
    config.tabs.find(
      (candidate) =>
        candidate.id === customTabId && candidate.kind === 'CUSTOM',
    ) ?? null
  );
};

const CATEGORY_TABS: CategoryTab[] = [
  {
    type: PieceSelectorTabType.AI_AND_AGENTS,
    builtinTab: 'AI_AND_AGENTS',
    label: () => t('AI'),
    iconKey: 'Sparkles',
  },
  {
    type: PieceSelectorTabType.APPS,
    builtinTab: 'APPS',
    label: () => t('Apps'),
    iconKey: 'Puzzle',
  },
  {
    type: PieceSelectorTabType.DATA_TRANSFORMATION,
    builtinTab: 'DATA_TRANSFORMATION',
    label: () => t('Transform data'),
    iconKey: 'Shuffle',
  },
  {
    type: PieceSelectorTabType.FLOW_CONTROL,
    builtinTab: 'FLOW_CONTROL',
    label: () => t('Flow control'),
    iconKey: 'Split',
  },
  {
    type: PieceSelectorTabType.UTILITY,
    builtinTab: 'UTILITY',
    label: () => t('Core tools'),
    iconKey: 'Wrench',
  },
  {
    type: PieceSelectorTabType.APPROVALS,
    builtinTab: 'APPROVALS',
    label: () => t('Human in the loop'),
    iconKey: 'UserCheck',
  },
];

export const pieceSelectorCustomization = {
  buildResolvedTabs,
  getCategoryTabs,
  isCategoryTabType,
  getCustomTab,
  getEditableTabConfigs,
  getBuiltinTabDisplay,
  getRandomIconKey,
  renderIcon,
};

export const PIECE_SELECTOR_TAB_ICON_OPTIONS: {
  key: string;
  Icon: LucideIcon;
}[] = Object.entries(PIECE_SELECTOR_TAB_ICONS).map(([key, Icon]) => ({
  key,
  Icon,
}));

export type ResolvedPieceSelectorTab = {
  key: string;
  type: PieceSelectorTabType;
  customTabId?: string;
  name: string;
  icon: React.ReactNode;
};

type DefaultBuiltinTab = {
  value: PieceSelectorTabType;
  name: string;
  icon: React.ReactNode;
};

type CategoryTab = {
  type: PieceSelectorCategoryType;
  builtinTab: NonNullable<PieceSelectorTabConfig['builtinTab']>;
  label: () => string;
  iconKey: string;
};
