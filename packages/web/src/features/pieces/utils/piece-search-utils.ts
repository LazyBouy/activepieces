import { isNil } from '@activepieces/core-utils';
import { PieceMetadataModelSummary } from '@activepieces/pieces-framework';
import {
  AI_PIECE_NAME,
  FlowActionType,
  FlowTriggerType,
  opencodeStepUtil,
  PieceCategory,
} from '@activepieces/shared';
import { t } from 'i18next';

import {
  PieceSelectorCategoryType,
  PieceSelectorTabType,
} from '@/features/pieces/stores/piece-selector-tabs-provider';
import {
  PieceSelectorItem,
  PieceSelectorSection,
  PieceSelectorSectionEntry,
  PieceSelectorTriggerListKind,
  PieceSelectorTriggerOption,
  PieceStepMetadataWithSuggestions,
  PrimitiveStepMetadata,
  StepMetadataWithSuggestions,
} from '@/features/pieces/types';

function getCategorySections({
  category,
  steps,
  pinnedPieceNames,
  aiPieceItems,
}: {
  category: PieceSelectorCategoryType;
  steps: StepMetadataWithSuggestions[];
  pinnedPieceNames: string[];
  aiPieceItems: PieceSelectorItem[];
}): PieceSelectorSection[] {
  const pieces = getPieces(steps);
  return buildSections({
    definitions: CATEGORY_SECTIONS[category],
    context: {
      steps,
      pieces,
      appPieces: pieces.filter(isAppPiece),
      pinnedPieceNames,
      aiPieceItems,
    },
  });
}

function getTriggerListSections({
  list,
  steps,
  pinnedPieceNames,
}: {
  list: PieceSelectorTriggerListKind;
  steps: StepMetadataWithSuggestions[];
  pinnedPieceNames: string[];
}): PieceSelectorSection[] {
  const pieces = getPieces(steps);
  return buildSections({
    definitions: TRIGGER_LIST_SECTIONS[list],
    context: {
      steps,
      pieces,
      appPieces: pieces.filter((piece) => !isCorePiece(piece)),
      pinnedPieceNames,
      aiPieceItems: [],
    },
  });
}

function getTriggerOptions({
  steps,
  pinnedPieceNames,
}: {
  steps: StepMetadataWithSuggestions[];
  pinnedPieceNames: string[];
}): PieceSelectorTriggerOption[] {
  const pieces = getPieces(steps);
  return TRIGGER_OPTIONS.flatMap((option): PieceSelectorTriggerOption[] => {
    const target = option.target;
    switch (target.kind) {
      case 'pick': {
        const triggerName = target.triggerName;
        const metadata = findPiece({ pieces, pieceName: target.pieceName });
        const trigger = metadata?.suggestedTriggers?.find(
          (candidate) => candidate.name === triggerName,
        );
        if (isNil(metadata) || isNil(trigger)) {
          return [];
        }
        return [
          {
            id: option.id,
            kind: 'pick',
            item: {
              actionOrTrigger: trigger,
              type: FlowTriggerType.PIECE,
              pieceMetadata: metadata,
            },
          },
        ];
      }
      case 'piece': {
        const metadata = findPiece({ pieces, pieceName: target.pieceName });
        return isNil(metadata)
          ? []
          : [{ id: option.id, kind: 'piece', metadata }];
      }
      case 'list': {
        const sections = getTriggerListSections({
          list: target.list,
          steps,
          pinnedPieceNames,
        });
        return sections.length === 0
          ? []
          : [{ id: option.id, kind: 'list', list: target.list }];
      }
    }
  });
}

function getPinnedPieces({
  steps,
  pinnedPieceNames,
}: {
  steps: StepMetadataWithSuggestions[];
  pinnedPieceNames: string[];
}): PieceStepMetadataWithSuggestions[] {
  return sortByNameOrder({
    pieces: getPieces(steps).filter((piece) =>
      pinnedPieceNames.includes(piece.pieceName),
    ),
    names: pinnedPieceNames,
  });
}

function withoutOfficialVendorChatActions({
  steps,
  installedPieceNames,
}: {
  steps: StepMetadataWithSuggestions[];
  installedPieceNames: string[];
}): StepMetadataWithSuggestions[] {
  return steps.map((step) =>
    step.type === FlowActionType.PIECE
      ? withoutPieceVendorChatActions({ piece: step, installedPieceNames })
      : step,
  );
}

function withoutPieceVendorChatActions({
  piece,
  installedPieceNames,
}: {
  piece: PieceStepMetadataWithSuggestions;
  installedPieceNames: string[];
}): PieceStepMetadataWithSuggestions {
  const hidden = opencodeStepUtil.hiddenOfficialActions({
    pieceName: piece.pieceName,
    installedPieceNames,
  });
  if (hidden.length === 0 || piece.type !== FlowActionType.PIECE) {
    return piece;
  }
  return {
    ...piece,
    suggestedActions: (piece.suggestedActions ?? []).filter(
      (action) => !hidden.includes(action.name),
    ),
  };
}

function isHiddenCatalogPiece({
  piece,
  installedPieceNames,
}: {
  piece: PieceMetadataModelSummary;
  installedPieceNames: string[];
}): boolean {
  const hidden = opencodeStepUtil.hiddenOfficialActions({
    pieceName: piece.name,
    installedPieceNames,
  });
  return hidden.length > 0 && piece.actions <= hidden.length;
}

function isCorePiece(piece: PieceStepMetadataWithSuggestions): boolean {
  return (
    piece.categories.includes(PieceCategory.CORE) ||
    CORE_PIECES_OUTSIDE_CORE_CATEGORY.includes(piece.pieceName)
  );
}

function isAiServicePiece(piece: PieceStepMetadataWithSuggestions): boolean {
  if (isCorePiece(piece) || piece.pieceName === AI_PIECE_NAME) {
    return false;
  }
  return (
    AI_SERVICE_PIECE_NAMES.includes(piece.pieceName) ||
    AI_CATEGORIES.some((category) => piece.categories.includes(category))
  );
}

function isAppPiece(piece: PieceStepMetadataWithSuggestions): boolean {
  return (
    !isCorePiece(piece) &&
    piece.pieceName !== AI_PIECE_NAME &&
    !isAiServicePiece(piece)
  );
}

function buildSections({
  definitions,
  context,
}: {
  definitions: SectionDefinition[];
  context: SectionContext;
}): PieceSelectorSection[] {
  return definitions.flatMap((definition) => {
    const entries = definition.members.flatMap((member) =>
      resolveMember({ member, context }),
    );
    if (entries.length === 0) {
      return [];
    }
    return [
      {
        id: definition.id,
        title: isNil(definition.title) ? null : definition.title(),
        entries:
          definition.order === 'alphabetical'
            ? sortEntriesByName(entries)
            : entries,
      },
    ];
  });
}

function resolveMember({
  member,
  context,
}: {
  member: SectionMember;
  context: SectionContext;
}): PieceSelectorSectionEntry[] {
  switch (member.kind) {
    case 'built-in': {
      const stepType = member.stepType;
      const step = context.steps.find(
        (candidate): candidate is PrimitiveStepMetadata =>
          candidate.type === stepType,
      );
      return isNil(step) ? [] : [{ kind: 'step', metadata: step }];
    }
    case 'piece': {
      const piece = findPiece({
        pieces: context.pieces,
        pieceName: member.pieceName,
      });
      return isNil(piece) ? [] : [{ kind: 'step', metadata: piece }];
    }
    case 'actions':
      return getActionEntries({
        piece: findPiece({
          pieces: context.pieces,
          pieceName: member.pieceName,
        }),
        actionNames: member.actionNames,
      });
    case 'ai-piece-actions':
      return context.aiPieceItems.map((item) => ({ kind: 'item', item }));
    case 'ai-service-pieces':
      return toStepEntries(context.pieces.filter(isAiServicePiece));
    case 'unplaced-core-pieces':
      return toStepEntries(
        context.pieces.filter(
          (piece) =>
            isCorePiece(piece) && !PLACED_PIECE_NAMES.includes(piece.pieceName),
        ),
      );
    case 'app-pieces':
      return toStepEntries(
        getAppGroup({
          appPieces: context.appPieces,
          pinnedPieceNames: context.pinnedPieceNames,
          group: member.group,
        }),
      );
    case 'other-trigger-pieces':
      return toStepEntries(
        context.pieces.filter(
          (piece) =>
            isCorePiece(piece) &&
            !TRIGGER_OPTION_PIECE_NAMES.includes(piece.pieceName),
        ),
      );
  }
}

function getAppGroup({
  appPieces,
  pinnedPieceNames,
  group,
}: {
  appPieces: PieceStepMetadataWithSuggestions[];
  pinnedPieceNames: string[];
  group: AppGroup;
}): PieceStepMetadataWithSuggestions[] {
  const isPinned = (piece: PieceStepMetadataWithSuggestions) =>
    pinnedPieceNames.includes(piece.pieceName);
  const isPopular = (piece: PieceStepMetadataWithSuggestions) =>
    POPULAR_PIECES_NAMES.includes(piece.pieceName);
  switch (group) {
    case 'pinned':
      return appPieces.filter(isPinned);
    case 'popular':
      return sortByNameOrder({
        pieces: appPieces.filter(
          (piece) => isPopular(piece) && !isPinned(piece),
        ),
        names: POPULAR_PIECES_NAMES,
      });
    case 'other':
      return appPieces.filter((piece) => !isPopular(piece) && !isPinned(piece));
  }
}

function getActionEntries({
  piece,
  actionNames,
}: {
  piece: PieceStepMetadataWithSuggestions | undefined;
  actionNames: string[] | 'all';
}): PieceSelectorSectionEntry[] {
  if (isNil(piece) || piece.type !== FlowActionType.PIECE) {
    return [];
  }
  const actions = piece.suggestedActions ?? [];
  const selected =
    actionNames === 'all'
      ? actions
      : actionNames.flatMap((name) =>
          actions.filter((action) => action.name === name),
        );
  return selected.map((action) => ({
    kind: 'item',
    item: {
      actionOrTrigger: action,
      type: FlowActionType.PIECE,
      pieceMetadata: piece,
    },
  }));
}

function getPieces(
  steps: StepMetadataWithSuggestions[],
): PieceStepMetadataWithSuggestions[] {
  return steps.filter(
    (step): step is PieceStepMetadataWithSuggestions =>
      step.type === FlowActionType.PIECE || step.type === FlowTriggerType.PIECE,
  );
}

function findPiece({
  pieces,
  pieceName,
}: {
  pieces: PieceStepMetadataWithSuggestions[];
  pieceName: string;
}): PieceStepMetadataWithSuggestions | undefined {
  return pieces.find((piece) => piece.pieceName === pieceName);
}

function toStepEntries(
  pieces: PieceStepMetadataWithSuggestions[],
): PieceSelectorSectionEntry[] {
  return pieces.map((metadata) => ({ kind: 'step', metadata }));
}

function sortByNameOrder({
  pieces,
  names,
}: {
  pieces: PieceStepMetadataWithSuggestions[];
  names: string[];
}): PieceStepMetadataWithSuggestions[] {
  return [...pieces].sort(
    (first, second) =>
      names.indexOf(first.pieceName) - names.indexOf(second.pieceName),
  );
}

function sortEntriesByName(
  entries: PieceSelectorSectionEntry[],
): PieceSelectorSectionEntry[] {
  return [...entries].sort((first, second) =>
    getEntryName(first).localeCompare(getEntryName(second)),
  );
}

function getEntryName(entry: PieceSelectorSectionEntry): string {
  if (entry.kind === 'step') {
    return entry.metadata.displayName;
  }
  const item = entry.item;
  return item.type === FlowActionType.PIECE ||
    item.type === FlowTriggerType.PIECE
    ? item.actionOrTrigger.displayName
    : item.displayName;
}

function builtInMember(stepType: BuiltInStepType): SectionMember {
  return { kind: 'built-in', stepType };
}

function pieceMember(pieceName: string): SectionMember {
  return { kind: 'piece', pieceName };
}

function actionsMember({
  pieceName,
  actionNames,
}: {
  pieceName: string;
  actionNames: string[] | 'all';
}): SectionMember {
  return { kind: 'actions', pieceName, actionNames };
}

const PIECE = {
  ACTIVEPIECES_PLATFORM: '@activepieces/piece-activepieces',
  APPROVAL: '@activepieces/piece-approval',
  AZURE_OPENAI: '@activepieces/piece-azure-openai',
  COHERE: '@activepieces/piece-cohere',
  CONNECTIONS: '@activepieces/piece-connections',
  CRYPTO: '@activepieces/piece-crypto',
  CSV: '@activepieces/piece-csv',
  DATA_MAPPER: '@activepieces/piece-data-mapper',
  DATA_SUMMARIZER: '@activepieces/piece-data-summarizer',
  DATE_HELPER: '@activepieces/piece-date-helper',
  DELAY: '@activepieces/piece-delay',
  FILE_HELPER: '@activepieces/piece-file-helper',
  FLOW_HELPER: '@activepieces/piece-flow-helper',
  FORMS: '@activepieces/piece-forms',
  GRAPHQL: '@activepieces/piece-graphql',
  GZIP: '@iphi-flow/piece-gzip',
  HTTP: '@activepieces/piece-http',
  IMAGE_HELPER: '@activepieces/piece-image-helper',
  JSON_WEB_TOKENS: '@iphi-flow/piece-json-web-tokens',
  LIST_TOOLS: '@iphi-flow/piece-list-tools',
  MANUAL_TRIGGER: '@activepieces/piece-manual-trigger',
  MATH_HELPER: '@activepieces/piece-math-helper',
  ONE_TIME_PASSWORDS: '@iphi-flow/piece-one-time-passwords',
  PDF: '@activepieces/piece-pdf',
  QRCODE: '@activepieces/piece-qrcode',
  SCHEDULE: '@activepieces/piece-schedule',
  SFTP: '@activepieces/piece-sftp',
  SMTP: '@activepieces/piece-smtp',
  STORE: '@activepieces/piece-store',
  SUBFLOWS: '@activepieces/piece-subflows',
  TABLES: '@activepieces/piece-tables',
  TAGS: '@activepieces/piece-tags',
  TEXT_HELPER: '@activepieces/piece-text-helper',
  WEBHOOK: '@activepieces/piece-webhook',
  XML: '@activepieces/piece-xml',
};

const APPROVAL_PIECES_CONFIG = [
  {
    pieceName: '@activepieces/piece-slack',
    approvalActionNames: [
      'request_approval_message',
      'request_approval_direct_message',
    ],
  },
  {
    pieceName: '@activepieces/piece-discord',
    approvalActionNames: ['request_approval_message'],
  },
  {
    pieceName: '@activepieces/piece-microsoft-teams',
    approvalActionNames: [
      'request_approval_direct_message',
      'request_approval_in_channel',
    ],
  },
  {
    pieceName: '@activepieces/piece-microsoft-outlook',
    approvalActionNames: ['request_approval_in_mail'],
  },
  {
    pieceName: '@activepieces/piece-gmail',
    approvalActionNames: ['request_approval_in_mail'],
  },
  {
    pieceName: '@activepieces/piece-telegram-bot',
    approvalActionNames: ['request_approval_message'],
  },
];

const POPULAR_PIECES_NAMES = [
  '@activepieces/piece-google-sheets',
  '@activepieces/piece-slack',
  '@activepieces/piece-notion',
  '@activepieces/piece-gmail',
  '@activepieces/piece-hubspot',
  '@activepieces/piece-openai',
  '@activepieces/piece-google-forms',
  '@activepieces/piece-google-drive',
  '@activepieces/piece-google-docs',
];

const AI_SERVICE_PIECE_NAMES = [PIECE.AZURE_OPENAI, PIECE.COHERE];

const AI_CATEGORIES: string[] = [
  PieceCategory.ARTIFICIAL_INTELLIGENCE,
  PieceCategory.UNIVERSAL_AI,
];

const CORE_PIECES_OUTSIDE_CORE_CATEGORY = [
  PIECE.FLOW_HELPER,
  PIECE.ACTIVEPIECES_PLATFORM,
];

const TRIGGER_ONLY_PIECE_NAMES = [PIECE.MANUAL_TRIGGER, PIECE.SCHEDULE];

const APP_SECTIONS: SectionDefinition[] = [
  {
    id: 'highlights',
    title: () => t('Highlights'),
    order: 'alphabetical',
    members: [{ kind: 'app-pieces', group: 'pinned' }],
  },
  {
    id: 'popular',
    title: () => t('Popular'),
    order: 'listed',
    members: [{ kind: 'app-pieces', group: 'popular' }],
  },
  {
    id: 'apps',
    title: () => t('Apps'),
    order: 'alphabetical',
    members: [{ kind: 'app-pieces', group: 'other' }],
  },
];

const CATEGORY_SECTIONS: Record<
  PieceSelectorCategoryType,
  SectionDefinition[]
> = {
  [PieceSelectorTabType.AI_AND_AGENTS]: [
    {
      id: 'popular',
      title: () => t('Popular'),
      order: 'listed',
      members: [
        { kind: 'ai-piece-actions' },
        builtInMember(FlowActionType.AI_ROUTER),
      ],
    },
    {
      id: 'ai-services',
      title: () => t('AI services'),
      order: 'alphabetical',
      members: [{ kind: 'ai-service-pieces' }],
    },
  ],
  [PieceSelectorTabType.APPS]: APP_SECTIONS,
  [PieceSelectorTabType.DATA_TRANSFORMATION]: [
    {
      id: 'popular',
      title: () => t('Popular'),
      order: 'listed',
      members: [
        builtInMember(FlowActionType.CODE),
        pieceMember(PIECE.TEXT_HELPER),
        pieceMember(PIECE.DATE_HELPER),
        pieceMember(PIECE.DATA_MAPPER),
      ],
    },
    {
      id: 'work-with-lists',
      title: () => t('Work with lists'),
      order: 'listed',
      members: [pieceMember(PIECE.LIST_TOOLS)],
    },
    {
      id: 'formats-and-files',
      title: () => t('Formats and files'),
      order: 'alphabetical',
      members: [
        pieceMember(PIECE.CSV),
        pieceMember(PIECE.XML),
        pieceMember(PIECE.FILE_HELPER),
        pieceMember(PIECE.PDF),
        pieceMember(PIECE.IMAGE_HELPER),
        pieceMember(PIECE.QRCODE),
        pieceMember(PIECE.CRYPTO),
        pieceMember(PIECE.JSON_WEB_TOKENS),
        pieceMember(PIECE.ONE_TIME_PASSWORDS),
        pieceMember(PIECE.GZIP),
      ],
    },
    {
      id: 'others',
      title: () => t('Others'),
      order: 'alphabetical',
      members: [
        pieceMember(PIECE.DATA_SUMMARIZER),
        pieceMember(PIECE.MATH_HELPER),
      ],
    },
  ],
  [PieceSelectorTabType.FLOW_CONTROL]: [
    {
      id: 'popular',
      title: () => t('Popular'),
      order: 'listed',
      members: [
        builtInMember(FlowActionType.ROUTER),
        builtInMember(FlowActionType.LOOP_ON_ITEMS),
      ],
    },
    {
      id: 'others',
      title: () => t('Others'),
      order: 'alphabetical',
      members: [
        builtInMember(FlowActionType.AI_ROUTER),
        pieceMember(PIECE.DELAY),
        pieceMember(PIECE.SUBFLOWS),
        pieceMember(PIECE.FLOW_HELPER),
      ],
    },
  ],
  [PieceSelectorTabType.UTILITY]: [
    {
      id: 'popular',
      title: () => t('Popular'),
      order: 'listed',
      members: [
        pieceMember(PIECE.HTTP),
        pieceMember(PIECE.WEBHOOK),
        builtInMember(FlowActionType.CODE),
        pieceMember(PIECE.TABLES),
      ],
    },
    {
      id: 'others',
      title: () => t('Others'),
      order: 'alphabetical',
      members: [
        pieceMember(PIECE.STORE),
        pieceMember(PIECE.GRAPHQL),
        pieceMember(PIECE.SMTP),
        pieceMember(PIECE.SFTP),
        actionsMember({
          pieceName: PIECE.FORMS,
          actionNames: ['return_response'],
        }),
        pieceMember(PIECE.CONNECTIONS),
        pieceMember(PIECE.TAGS),
        pieceMember(PIECE.ACTIVEPIECES_PLATFORM),
        { kind: 'unplaced-core-pieces' },
      ],
    },
  ],
  [PieceSelectorTabType.APPROVALS]: [
    {
      id: 'ask-a-person',
      title: () => t('Ask a person'),
      order: 'listed',
      members: [
        ...APPROVAL_PIECES_CONFIG.map((config) =>
          actionsMember({
            pieceName: config.pieceName,
            actionNames: config.approvalActionNames,
          }),
        ),
        actionsMember({ pieceName: PIECE.APPROVAL, actionNames: 'all' }),
      ],
    },
  ],
};

const TRIGGER_LIST_SECTIONS: Record<
  PieceSelectorTriggerListKind,
  SectionDefinition[]
> = {
  apps: APP_SECTIONS,
  other: [
    {
      id: 'other-triggers',
      title: null,
      order: 'alphabetical',
      members: [{ kind: 'other-trigger-pieces' }],
    },
  ],
};

const TRIGGER_OPTIONS: TriggerOptionDefinition[] = [
  {
    id: 'manual',
    target: {
      kind: 'pick',
      pieceName: PIECE.MANUAL_TRIGGER,
      triggerName: 'manual_trigger',
    },
  },
  { id: 'apps', target: { kind: 'list', list: 'apps' } },
  { id: 'schedule', target: { kind: 'piece', pieceName: PIECE.SCHEDULE } },
  {
    id: 'webhook',
    target: {
      kind: 'pick',
      pieceName: PIECE.WEBHOOK,
      triggerName: 'catch_webhook',
    },
  },
  {
    id: 'form',
    target: {
      kind: 'pick',
      pieceName: PIECE.FORMS,
      triggerName: 'form_submission',
    },
  },
  {
    id: 'chat',
    target: {
      kind: 'pick',
      pieceName: PIECE.FORMS,
      triggerName: 'chat_submission',
    },
  },
  {
    id: 'subflow',
    target: {
      kind: 'pick',
      pieceName: PIECE.SUBFLOWS,
      triggerName: 'callableFlow',
    },
  },
  { id: 'other', target: { kind: 'list', list: 'other' } },
];

const PLACED_PIECE_NAMES: string[] = [
  ...Object.values(CATEGORY_SECTIONS)
    .flat()
    .flatMap((definition) => definition.members)
    .flatMap((member) =>
      member.kind === 'piece' || member.kind === 'actions'
        ? [member.pieceName]
        : [],
    ),
  ...TRIGGER_ONLY_PIECE_NAMES,
];

const TRIGGER_OPTION_PIECE_NAMES: string[] = TRIGGER_OPTIONS.flatMap((option) =>
  option.target.kind === 'list' ? [] : [option.target.pieceName],
);

export const pieceSearchUtils = {
  getCategorySections,
  getTriggerListSections,
  getTriggerOptions,
  getPinnedPieces,
  withoutOfficialVendorChatActions,
  withoutPieceVendorChatActions,
  isHiddenCatalogPiece,
  POPULAR_PIECES_NAMES,
};

type BuiltInStepType =
  | FlowActionType.CODE
  | FlowActionType.LOOP_ON_ITEMS
  | FlowActionType.ROUTER
  | FlowActionType.AI_ROUTER;

type AppGroup = 'pinned' | 'popular' | 'other';

type SectionMember =
  | { kind: 'built-in'; stepType: BuiltInStepType }
  | { kind: 'piece'; pieceName: string }
  | { kind: 'actions'; pieceName: string; actionNames: string[] | 'all' }
  | { kind: 'ai-piece-actions' }
  | { kind: 'ai-service-pieces' }
  | { kind: 'unplaced-core-pieces' }
  | { kind: 'app-pieces'; group: AppGroup }
  | { kind: 'other-trigger-pieces' };

type SectionDefinition = {
  id: string;
  title: (() => string) | null;
  order: 'listed' | 'alphabetical';
  members: SectionMember[];
};

type SectionContext = {
  steps: StepMetadataWithSuggestions[];
  pieces: PieceStepMetadataWithSuggestions[];
  appPieces: PieceStepMetadataWithSuggestions[];
  pinnedPieceNames: string[];
  aiPieceItems: PieceSelectorItem[];
};

type TriggerOptionDefinition = {
  id: PieceSelectorTriggerOption['id'];
  target:
    | { kind: 'pick'; pieceName: string; triggerName: string }
    | { kind: 'piece'; pieceName: string }
    | { kind: 'list'; list: PieceSelectorTriggerListKind };
};
