import {
  ActionBase,
  TriggerBase,
  TriggerStrategy,
} from '@activepieces/pieces-framework';
import {
  FlowActionType,
  FlowTriggerType,
  PackageType,
  PieceCategory,
  PieceType,
} from '@activepieces/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({ t: (key: string) => key }));

import { PieceSelectorTabType } from '@/features/pieces/stores/piece-selector-tabs-provider';
import {
  PieceSelectorItem,
  PieceSelectorSection,
  PieceSelectorSectionEntry,
  PieceStepMetadataWithSuggestions,
  PrimitiveStepMetadata,
  StepMetadataWithSuggestions,
} from '@/features/pieces/types';
import { pieceSearchUtils } from '@/features/pieces/utils/piece-search-utils';

describe('piece category map, next-step and replace modes', () => {
  const steps = actionSteps();

  it('fills the AI category with the AI piece actions, the AI Router and AI services', () => {
    const sections = sectionsFor({
      category: PieceSelectorTabType.AI_AND_AGENTS,
      aiPieceItems: aiPieceItems(),
    });
    expect(describeSections(sections)).toEqual([
      {
        title: 'Popular',
        entries: [
          `${AI_PIECE}/askAi`,
          `${AI_PIECE}/run_agent`,
          FlowActionType.AI_ROUTER,
        ],
      },
      {
        title: 'AI services',
        entries: [
          pieceName('azure-openai'),
          pieceName('cohere'),
          pieceName('exa'),
          pieceName('openai'),
          pieceName('perplexity-ai'),
        ],
      },
    ]);
  });

  it('hides the AI popular section when the AI piece and the AI Router are unavailable', () => {
    const sections = pieceSearchUtils.getCategorySections({
      category: PieceSelectorTabType.AI_AND_AGENTS,
      steps: steps.filter((step) => step.type !== FlowActionType.AI_ROUTER),
      pinnedPieceNames: [],
      aiPieceItems: [],
    });
    expect(sections.map((section) => section.title)).toEqual(['AI services']);
  });

  it('lists every app piece in the Apps sections, pinned first, then popular in its own order', () => {
    const sections = sectionsFor({
      category: PieceSelectorTabType.APPS,
      pinnedPieceNames: [pieceName('zendesk'), pieceName('http')],
    });
    expect(describeSections(sections)).toEqual([
      { title: 'Highlights', entries: [pieceName('zendesk')] },
      {
        title: 'Popular',
        entries: [pieceName('slack'), pieceName('gmail')],
      },
      {
        title: 'Apps',
        entries: [
          pieceName('asana'),
          pieceName('discord'),
          pieceName('microsoft-outlook'),
          pieceName('microsoft-teams'),
          pieceName('telegram-bot'),
        ],
      },
    ]);
  });

  it('fills Transform data with its popular steps, list tools, formats and files, and others', () => {
    expect(
      describeSections(
        sectionsFor({ category: PieceSelectorTabType.DATA_TRANSFORMATION }),
      ),
    ).toEqual([
      {
        title: 'Popular',
        entries: [
          FlowActionType.CODE,
          pieceName('text-helper'),
          pieceName('date-helper'),
          pieceName('data-mapper'),
        ],
      },
      {
        title: 'Work with lists',
        entries: [LIST_TOOLS],
      },
      {
        title: 'Formats and files',
        entries: [
          pieceName('crypto'),
          pieceName('csv'),
          pieceName('file-helper'),
          GZIP,
          pieceName('image-helper'),
          JSON_WEB_TOKENS,
          ONE_TIME_PASSWORDS,
          pieceName('pdf'),
          pieceName('qrcode'),
          pieceName('xml'),
        ],
      },
      {
        title: 'Others',
        entries: [pieceName('data-summarizer'), pieceName('math-helper')],
      },
    ]);
  });

  it('fills Flow control with the router and loop first, then the other flow steps', () => {
    expect(
      describeSections(
        sectionsFor({ category: PieceSelectorTabType.FLOW_CONTROL }),
      ),
    ).toEqual([
      {
        title: 'Popular',
        entries: [FlowActionType.ROUTER, FlowActionType.LOOP_ON_ITEMS],
      },
      {
        title: 'Others',
        entries: [
          FlowActionType.AI_ROUTER,
          pieceName('delay'),
          pieceName('flow-helper'),
          pieceName('subflows'),
        ],
      },
    ]);
  });

  it('fills Core tools with HTTP, Webhook, Code and Tables first, then the other building blocks', () => {
    expect(
      describeSections(sectionsFor({ category: PieceSelectorTabType.UTILITY })),
    ).toEqual([
      {
        title: 'Popular',
        entries: [
          pieceName('http'),
          pieceName('webhook'),
          FlowActionType.CODE,
          pieceName('tables'),
        ],
      },
      {
        title: 'Others',
        entries: [
          pieceName('activepieces'),
          pieceName('connections'),
          pieceName('sftp'),
          pieceName('graphql'),
          `${pieceName('forms')}/return_response`,
          pieceName('smtp'),
          pieceName('store'),
          pieceName('tags'),
        ],
      },
    ]);
  });

  it('fills Human in the loop with the app approval actions and then the Approval piece', () => {
    expect(
      describeSections(
        sectionsFor({ category: PieceSelectorTabType.APPROVALS }),
      ),
    ).toEqual([
      {
        title: 'Ask a person',
        entries: [
          `${pieceName('slack')}/request_approval_message`,
          `${pieceName('slack')}/request_approval_direct_message`,
          `${pieceName('discord')}/request_approval_message`,
          `${pieceName('microsoft-teams')}/request_approval_direct_message`,
          `${pieceName('microsoft-teams')}/request_approval_in_channel`,
          `${pieceName('microsoft-outlook')}/request_approval_in_mail`,
          `${pieceName('gmail')}/request_approval_in_mail`,
          `${pieceName('telegram-bot')}/request_approval_message`,
          `${pieceName('approval')}/wait_for_approval`,
          `${pieceName('approval')}/create_approval_links`,
        ],
      },
    ]);
  });

  it('gives every core piece exactly one home and keeps the trigger-only pieces out', () => {
    const homes = CORE_PIECE_SLUGS.map((slug) => ({
      slug,
      categories: CATEGORIES.filter((category) =>
        sectionsFor({ category, aiPieceItems: aiPieceItems() })
          .flatMap((section) => section.entries)
          .some((entry) => entryPieceName(entry) === pieceName(slug)),
      ),
    }));
    expect(homes).toEqual(
      CORE_PIECE_SLUGS.map((slug) => ({
        slug,
        categories: EXPECTED_CORE_HOMES[slug],
      })),
    );
  });

  it('places List Tools second in Transform data, under Work with lists, and nowhere else', () => {
    const homes = CATEGORIES.filter((category) =>
      sectionsFor({ category, aiPieceItems: aiPieceItems() })
        .flatMap((section) => section.entries)
        .some((entry) => entryPieceName(entry) === LIST_TOOLS),
    );
    expect(homes).toEqual([PieceSelectorTabType.DATA_TRANSFORMATION]);
    const sections = sectionsFor({
      category: PieceSelectorTabType.DATA_TRANSFORMATION,
    });
    expect(sections[1].id).toBe('work-with-lists');
    expect(sections[1].title).toBe('Work with lists');
  });

  it('hides Work with lists when List Tools is not downloaded', () => {
    const sections = pieceSearchUtils.getCategorySections({
      category: PieceSelectorTabType.DATA_TRANSFORMATION,
      steps: steps.filter(
        (step) =>
          step.type !== FlowActionType.PIECE || step.pieceName !== LIST_TOOLS,
      ),
      pinnedPieceNames: [],
      aiPieceItems: [],
    });
    expect(sections.map((section) => section.id)).toEqual([
      'popular',
      'formats-and-files',
      'others',
    ]);
  });

  it('places JSON Web Tokens, One-Time Passwords and Gzip in Transform data, under Formats and files, and nowhere else', () => {
    const transformSections = sectionsFor({
      category: PieceSelectorTabType.DATA_TRANSFORMATION,
    });
    const placements = NEW_FORMAT_PIECES.map((name) => ({
      name,
      categories: CATEGORIES.filter((category) =>
        sectionsFor({ category, aiPieceItems: aiPieceItems() })
          .flatMap((section) => section.entries)
          .some((entry) => entryPieceName(entry) === name),
      ),
      sections: transformSections
        .filter((section) =>
          section.entries.some((entry) => entryPieceName(entry) === name),
        )
        .map((section) => section.id),
    }));
    expect(placements).toEqual(
      NEW_FORMAT_PIECES.map((name) => ({
        name,
        categories: [PieceSelectorTabType.DATA_TRANSFORMATION],
        sections: ['formats-and-files'],
      })),
    );
  });

  it('keeps Formats and files as before when the new pieces are not downloaded', () => {
    const sections = pieceSearchUtils.getCategorySections({
      category: PieceSelectorTabType.DATA_TRANSFORMATION,
      steps: steps.filter(
        (step) =>
          step.type !== FlowActionType.PIECE ||
          !NEW_FORMAT_PIECES.includes(step.pieceName),
      ),
      pinnedPieceNames: [],
      aiPieceItems: [],
    });
    expect(
      sections
        .find((section) => section.id === 'formats-and-files')
        ?.entries.map(entryId),
    ).toEqual([
      pieceName('crypto'),
      pieceName('csv'),
      pieceName('file-helper'),
      pieceName('image-helper'),
      pieceName('pdf'),
      pieceName('qrcode'),
      pieceName('xml'),
    ]);
  });

  it('places each built-in step in its categories', () => {
    const placements = BUILT_IN_TYPES.map((type) => ({
      type,
      categories: CATEGORIES.filter((category) =>
        sectionsFor({ category })
          .flatMap((section) => section.entries)
          .some(
            (entry) => entry.kind === 'step' && entry.metadata.type === type,
          ),
      ),
    }));
    expect(placements).toEqual([
      {
        type: FlowActionType.CODE,
        categories: [
          PieceSelectorTabType.DATA_TRANSFORMATION,
          PieceSelectorTabType.UTILITY,
        ],
      },
      {
        type: FlowActionType.LOOP_ON_ITEMS,
        categories: [PieceSelectorTabType.FLOW_CONTROL],
      },
      {
        type: FlowActionType.ROUTER,
        categories: [PieceSelectorTabType.FLOW_CONTROL],
      },
      {
        type: FlowActionType.AI_ROUTER,
        categories: [
          PieceSelectorTabType.AI_AND_AGENTS,
          PieceSelectorTabType.FLOW_CONTROL,
        ],
      },
    ]);
  });

  it('keeps the AI piece itself out of AI services and Apps, and a generic app only in Apps', () => {
    const homesOf = (name: string) =>
      CATEGORIES.filter((category) =>
        sectionsFor({ category })
          .flatMap((section) => section.entries)
          .some(
            (entry) => entry.kind === 'step' && entryPieceName(entry) === name,
          ),
      );
    expect(homesOf(AI_PIECE)).toEqual([]);
    expect(homesOf(pieceName('asana'))).toEqual([PieceSelectorTabType.APPS]);
    expect(homesOf(pieceName('slack'))).toEqual([PieceSelectorTabType.APPS]);
  });

  it('puts a core piece the map does not name into Core tools', () => {
    const extra = actionPiece({
      slug: 'zip-helper',
      displayName: 'Zip Helper',
      categories: [PieceCategory.CORE],
      actions: [action('zip', 'Zip')],
    });
    const sections = pieceSearchUtils.getCategorySections({
      category: PieceSelectorTabType.UTILITY,
      steps: [...steps, extra],
      pinnedPieceNames: [],
      aiPieceItems: [],
    });
    expect(
      sections
        .find((section) => section.id === 'others')
        ?.entries.map(entryId)
        .at(-1),
    ).toBe(pieceName('zip-helper'));
  });

  it('hides sections whose pieces are not downloaded', () => {
    expect(
      pieceSearchUtils.getCategorySections({
        category: PieceSelectorTabType.APPROVALS,
        steps: steps.filter(
          (step) =>
            step.type !== FlowActionType.PIECE ||
            !APPROVAL_SOURCES.includes(step.pieceName),
        ),
        pinnedPieceNames: [],
        aiPieceItems: [],
      }),
    ).toEqual([]);
  });
});

describe('piece category map, trigger mode', () => {
  const steps = triggerSteps();

  it('lists the trigger rows in order and picks the direct triggers', () => {
    const options = pieceSearchUtils.getTriggerOptions({
      steps,
      pinnedPieceNames: [],
    });
    expect(
      options.map((option) => {
        switch (option.kind) {
          case 'pick':
            return `${option.id}:pick:${option.item.pieceMetadata.pieceName}/${option.item.actionOrTrigger.name}`;
          case 'piece':
            return `${option.id}:piece:${option.metadata.pieceName}`;
          case 'list':
            return `${option.id}:list:${option.list}`;
        }
      }),
    ).toEqual([
      `manual:pick:${pieceName('manual-trigger')}/manual_trigger`,
      'apps:list:apps',
      `schedule:piece:${pieceName('schedule')}`,
      `webhook:pick:${pieceName('webhook')}/catch_webhook`,
      `form:pick:${pieceName('forms')}/form_submission`,
      `chat:pick:${pieceName('forms')}/chat_submission`,
      `subflow:pick:${pieceName('subflows')}/callableFlow`,
      'other:list:other',
    ]);
    const manual = options[0];
    expect(manual.kind === 'pick' && manual.item.type).toBe(
      FlowTriggerType.PIECE,
    );
  });

  it('hides a trigger row whose piece is not downloaded', () => {
    const withoutManualOrTables = steps.filter(
      (step) =>
        step.type !== FlowTriggerType.PIECE ||
        ![
          pieceName('manual-trigger'),
          pieceName('tables'),
          pieceName('sftp'),
        ].includes(step.pieceName),
    );
    expect(
      pieceSearchUtils
        .getTriggerOptions({
          steps: withoutManualOrTables,
          pinnedPieceNames: [],
        })
        .map((option) => option.id),
    ).toEqual(['apps', 'schedule', 'webhook', 'form', 'chat', 'subflow']);
  });

  it('lists the remaining core trigger pieces under Other triggers, alphabetically', () => {
    expect(
      describeSections(
        pieceSearchUtils.getTriggerListSections({
          list: 'other',
          steps,
          pinnedPieceNames: [],
        }),
      ),
    ).toEqual([
      { title: null, entries: [pieceName('sftp'), pieceName('tables')] },
    ]);
  });

  it('lists app and AI pieces with triggers under From an app, with the Apps sections', () => {
    expect(
      describeSections(
        pieceSearchUtils.getTriggerListSections({
          list: 'apps',
          steps,
          pinnedPieceNames: [pieceName('zendesk')],
        }),
      ),
    ).toEqual([
      { title: 'Highlights', entries: [pieceName('zendesk')] },
      { title: 'Popular', entries: [pieceName('slack'), pieceName('gmail')] },
      { title: 'Apps', entries: [pieceName('asana'), pieceName('exa')] },
    ]);
  });
});

function sectionsFor({
  category,
  pinnedPieceNames = [],
  aiPieceItems = [],
}: {
  category: (typeof CATEGORIES)[number];
  pinnedPieceNames?: string[];
  aiPieceItems?: PieceSelectorItem[];
}): PieceSelectorSection[] {
  return pieceSearchUtils.getCategorySections({
    category,
    steps: actionSteps(),
    pinnedPieceNames,
    aiPieceItems,
  });
}

function describeSections(sections: PieceSelectorSection[]) {
  return sections.map((section) => ({
    title: section.title,
    entries: section.entries.map(entryId),
  }));
}

function entryId(entry: PieceSelectorSectionEntry): string {
  if (entry.kind === 'step') {
    return entry.metadata.type === FlowActionType.PIECE ||
      entry.metadata.type === FlowTriggerType.PIECE
      ? entry.metadata.pieceName
      : entry.metadata.type;
  }
  const item = entry.item;
  return item.type === FlowActionType.PIECE ||
    item.type === FlowTriggerType.PIECE
    ? `${item.pieceMetadata.pieceName}/${item.actionOrTrigger.name}`
    : item.type;
}

function entryPieceName(entry: PieceSelectorSectionEntry): string | null {
  if (entry.kind === 'step') {
    return entry.metadata.type === FlowActionType.PIECE ||
      entry.metadata.type === FlowTriggerType.PIECE
      ? entry.metadata.pieceName
      : null;
  }
  return entry.item.type === FlowActionType.PIECE ||
    entry.item.type === FlowTriggerType.PIECE
    ? entry.item.pieceMetadata.pieceName
    : null;
}

function actionSteps(): StepMetadataWithSuggestions[] {
  return [
    ...BUILT_IN_TYPES.map(builtInStep),
    ...PIECE_FIXTURES.filter((fixture) => fixture.actions.length > 0).map(
      (fixture) => actionPiece(fixture),
    ),
  ];
}

function triggerSteps(): StepMetadataWithSuggestions[] {
  return PIECE_FIXTURES.filter((fixture) => fixture.triggers.length > 0).map(
    (fixture) => ({
      ...actionPiece(fixture),
      type: FlowTriggerType.PIECE,
      suggestedActions: [],
      suggestedTriggers: fixture.triggers,
    }),
  );
}

function aiPieceItems(): PieceSelectorItem[] {
  const aiPiece = actionPiece({
    slug: 'ai',
    displayName: 'AI',
    categories: [
      PieceCategory.ARTIFICIAL_INTELLIGENCE,
      PieceCategory.UNIVERSAL_AI,
    ],
    actions: [action('askAi', 'Ask AI'), action('run_agent', 'Run Agent')],
  });
  return (aiPiece.suggestedActions ?? []).map((actionOrTrigger) => ({
    actionOrTrigger,
    type: FlowActionType.PIECE,
    pieceMetadata: aiPiece,
  }));
}

function builtInStep(
  type: (typeof BUILT_IN_TYPES)[number],
): PrimitiveStepMetadata {
  return {
    type,
    displayName: BUILT_IN_NAMES[type],
    description: `${BUILT_IN_NAMES[type]} step`,
    logoUrl: `https://example.test/${type}.svg`,
  };
}

function actionPiece({
  slug,
  displayName,
  packageName,
  categories = [],
  actions = [],
}: {
  slug: string;
  displayName: string;
  packageName?: string;
  categories?: string[];
  actions?: ActionBase[];
  triggers?: TriggerBase[];
}): PieceStepMetadataWithSuggestions {
  return {
    displayName,
    logoUrl: `https://example.test/${slug}.svg`,
    description: `${displayName} description`,
    type: FlowActionType.PIECE,
    pieceName: packageName ?? pieceName(slug),
    pieceVersion: '0.1.0',
    categories,
    packageType: PackageType.REGISTRY,
    pieceType: PieceType.OFFICIAL,
    auth: undefined,
    suggestedActions: actions,
    suggestedTriggers: [],
  };
}

function action(name: string, displayName: string): ActionBase {
  return {
    name,
    displayName,
    description: `${displayName} description`,
    props: {},
    requireAuth: false,
  };
}

function trigger(name: string, displayName: string): TriggerBase {
  return {
    name,
    displayName,
    description: `${displayName} description`,
    props: {},
    requireAuth: false,
    type: TriggerStrategy.POLLING,
    sampleData: {},
    testStrategy: TriggerBase.shape.testStrategy.def.entries.SIMULATION,
  };
}

function pieceName(slug: string): string {
  return `@activepieces/piece-${slug}`;
}

function fixture({
  slug,
  displayName,
  packageName,
  categories,
  actions = [],
  triggers = [],
}: {
  slug: string;
  displayName: string;
  packageName?: string;
  categories: string[];
  actions?: ActionBase[];
  triggers?: TriggerBase[];
}): PieceFixture {
  return { slug, displayName, packageName, categories, actions, triggers };
}

const CORE = [PieceCategory.CORE];
const CORE_FLOW = [PieceCategory.CORE, PieceCategory.FLOW_CONTROL];
const AI_PIECE = pieceName('ai');
const LIST_TOOLS = '@iphi-flow/piece-list-tools';
const JSON_WEB_TOKENS = '@iphi-flow/piece-json-web-tokens';
const ONE_TIME_PASSWORDS = '@iphi-flow/piece-one-time-passwords';
const GZIP = '@iphi-flow/piece-gzip';
const NEW_FORMAT_PIECES = [JSON_WEB_TOKENS, ONE_TIME_PASSWORDS, GZIP];

const BUILT_IN_TYPES = [
  FlowActionType.CODE,
  FlowActionType.LOOP_ON_ITEMS,
  FlowActionType.ROUTER,
  FlowActionType.AI_ROUTER,
] as const;

const BUILT_IN_NAMES: Record<(typeof BUILT_IN_TYPES)[number], string> = {
  [FlowActionType.CODE]: 'Code',
  [FlowActionType.LOOP_ON_ITEMS]: 'Loop on Items',
  [FlowActionType.ROUTER]: 'Router',
  [FlowActionType.AI_ROUTER]: 'AI Router',
};

const CATEGORIES = [
  PieceSelectorTabType.AI_AND_AGENTS,
  PieceSelectorTabType.APPS,
  PieceSelectorTabType.DATA_TRANSFORMATION,
  PieceSelectorTabType.FLOW_CONTROL,
  PieceSelectorTabType.UTILITY,
  PieceSelectorTabType.APPROVALS,
] as const;

const APPROVAL_SOURCES = [
  'slack',
  'discord',
  'microsoft-teams',
  'microsoft-outlook',
  'gmail',
  'telegram-bot',
  'approval',
].map(pieceName);

const PIECE_FIXTURES: PieceFixture[] = [
  fixture({
    slug: 'approval',
    displayName: 'Approval (Legacy)',
    categories: CORE_FLOW,
    actions: [
      action('wait_for_approval', 'Wait for Approval'),
      action('create_approval_links', 'Create Approval Links'),
    ],
  }),
  fixture({
    slug: 'connections',
    displayName: 'Connections',
    categories: CORE,
    actions: [action('read_connection', 'Read Connection')],
  }),
  fixture({
    slug: 'crypto',
    displayName: 'Crypto',
    categories: CORE,
    actions: [action('hash_text', 'Hash Text')],
  }),
  fixture({
    slug: 'csv',
    displayName: 'CSV',
    categories: CORE,
    actions: [action('parse_csv', 'Parse CSV')],
  }),
  fixture({
    slug: 'data-mapper',
    displayName: 'Data Mapper',
    categories: CORE,
    actions: [action('advanced_mapping', 'Advanced Mapping')],
  }),
  fixture({
    slug: 'data-summarizer',
    displayName: 'Data Summarizer',
    categories: CORE,
    actions: [action('calculateSum', 'Calculate Sum')],
  }),
  fixture({
    slug: 'date-helper',
    displayName: 'Date Helper',
    categories: CORE,
    actions: [action('get_current_date', 'Get Current Date')],
  }),
  fixture({
    slug: 'delay',
    displayName: 'Delay',
    categories: CORE_FLOW,
    actions: [action('delay_for', 'Delay For')],
  }),
  fixture({
    slug: 'file-helper',
    displayName: 'Files Helper',
    categories: CORE,
    actions: [action('read_file', 'Read File')],
  }),
  fixture({
    slug: 'forms',
    displayName: 'Human Input',
    categories: CORE,
    actions: [action('return_response', 'Respond on UI')],
    triggers: [
      trigger('form_submission', 'Web Form'),
      trigger('chat_submission', 'Chat UI'),
    ],
  }),
  fixture({
    slug: 'graphql',
    displayName: 'GraphQL',
    categories: CORE,
    actions: [action('send_request', 'Send Request')],
  }),
  fixture({
    slug: 'http',
    displayName: 'HTTP',
    categories: CORE,
    actions: [action('send_request', 'Send HTTP request')],
  }),
  fixture({
    slug: 'gzip',
    displayName: 'Gzip',
    packageName: GZIP,
    categories: CORE,
    actions: [action('compress_file', 'Compress File')],
  }),
  fixture({
    slug: 'image-helper',
    displayName: 'Image Helper',
    categories: CORE,
    actions: [action('resize_image', 'Resize Image')],
  }),
  fixture({
    slug: 'json-web-tokens',
    displayName: 'JSON Web Tokens',
    packageName: JSON_WEB_TOKENS,
    categories: CORE,
    actions: [action('create_token', 'Create Token')],
  }),
  fixture({
    slug: 'list-tools',
    displayName: 'List Tools',
    packageName: LIST_TOOLS,
    categories: CORE,
    actions: [action('filter_list', 'Filter List')],
  }),
  fixture({
    slug: 'manual-trigger',
    displayName: 'Manual Trigger',
    categories: CORE,
    triggers: [trigger('manual_trigger', 'Manual Trigger')],
  }),
  fixture({
    slug: 'math-helper',
    displayName: 'Math Helper',
    categories: CORE,
    actions: [action('addition', 'Addition')],
  }),
  fixture({
    slug: 'one-time-passwords',
    displayName: 'One-Time Passwords',
    packageName: ONE_TIME_PASSWORDS,
    categories: CORE,
    actions: [action('generate_code', 'Generate Code')],
  }),
  fixture({
    slug: 'pdf',
    displayName: 'PDF',
    categories: CORE,
    actions: [action('extract_text', 'Extract Text')],
  }),
  fixture({
    slug: 'qrcode',
    displayName: 'QR Code',
    categories: CORE,
    actions: [action('output_qrcode', 'Text to QR Code')],
  }),
  fixture({
    slug: 'schedule',
    displayName: 'Schedule',
    categories: CORE,
    triggers: [
      trigger('every_x_minutes', 'Every X Minutes'),
      trigger('cron_expression', 'Cron Expression'),
    ],
  }),
  fixture({
    slug: 'sftp',
    displayName: 'FTP/SFTP',
    categories: [PieceCategory.CORE, PieceCategory.DEVELOPER_TOOLS],
    actions: [action('upload_file', 'Upload File')],
    triggers: [trigger('new_file', 'New File')],
  }),
  fixture({
    slug: 'smtp',
    displayName: 'SMTP',
    categories: CORE,
    actions: [action('send_email', 'Send Email')],
  }),
  fixture({
    slug: 'store',
    displayName: 'Storage',
    categories: CORE,
    actions: [action('get', 'Get'), action('put', 'Put')],
  }),
  fixture({
    slug: 'subflows',
    displayName: 'Sub Flows',
    categories: CORE_FLOW,
    actions: [action('callFlow', 'Call Flow')],
    triggers: [trigger('callableFlow', 'Callable Flow')],
  }),
  fixture({
    slug: 'tables',
    displayName: 'Tables',
    categories: CORE,
    actions: [action('create_record', 'Create Record')],
    triggers: [trigger('newRecord', 'New Record')],
  }),
  fixture({
    slug: 'tags',
    displayName: 'Tags',
    categories: CORE,
    actions: [action('add_tag', 'Add Tag')],
  }),
  fixture({
    slug: 'text-helper',
    displayName: 'Text Helper',
    categories: CORE,
    actions: [action('concat', 'Concatenate')],
  }),
  fixture({
    slug: 'webhook',
    displayName: 'Webhook',
    categories: CORE,
    actions: [action('return_response', 'Return Response')],
    triggers: [trigger('catch_webhook', 'Catch Webhook')],
  }),
  fixture({
    slug: 'xml',
    displayName: 'XML',
    categories: CORE,
    actions: [action('convert_json_to_xml', 'Convert JSON to XML')],
  }),
  fixture({
    slug: 'ai',
    displayName: 'AI',
    categories: [
      PieceCategory.ARTIFICIAL_INTELLIGENCE,
      PieceCategory.UNIVERSAL_AI,
    ],
    actions: [action('askAi', 'Ask AI')],
  }),
  fixture({
    slug: 'openai',
    displayName: 'OpenAI',
    categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
    actions: [action('ask_chatgpt', 'Ask ChatGPT')],
  }),
  fixture({
    slug: 'perplexity-ai',
    displayName: 'Perplexity AI',
    categories: [PieceCategory.UNIVERSAL_AI],
    actions: [action('ask_ai', 'Ask AI')],
  }),
  fixture({
    slug: 'exa',
    displayName: 'Exa',
    categories: [PieceCategory.ARTIFICIAL_INTELLIGENCE],
    actions: [action('search', 'Search')],
    triggers: [trigger('new_result', 'New Result')],
  }),
  fixture({
    slug: 'azure-openai',
    displayName: 'Azure OpenAI',
    categories: [],
    actions: [action('ask_gpt', 'Ask GPT')],
  }),
  fixture({
    slug: 'cohere',
    displayName: 'Cohere',
    categories: [],
    actions: [action('generate_text', 'Generate Text')],
  }),
  fixture({
    slug: 'flow-helper',
    displayName: 'Flow Helper',
    categories: [],
    actions: [action('stopFlow', 'Stop Flow')],
  }),
  fixture({
    slug: 'activepieces',
    displayName: 'Activepieces Platform',
    categories: [],
    actions: [action('create_project', 'Create Project')],
  }),
  fixture({
    slug: 'asana',
    displayName: 'Asana',
    categories: [PieceCategory.PRODUCTIVITY],
    actions: [action('create_task', 'Create Task')],
    triggers: [trigger('new_task', 'New Task')],
  }),
  fixture({
    slug: 'zendesk',
    displayName: 'Zendesk',
    categories: [PieceCategory.CUSTOMER_SUPPORT],
    actions: [action('create_ticket', 'Create Ticket')],
    triggers: [trigger('new_ticket', 'New Ticket')],
  }),
  fixture({
    slug: 'slack',
    displayName: 'Slack',
    categories: [PieceCategory.COMMUNICATION],
    actions: [
      action('send_channel_message', 'Send Message To A Channel'),
      action('request_approval_direct_message', 'Request Approval from A User'),
      action('request_approval_message', 'Request Approval in a Channel'),
    ],
    triggers: [trigger('new-message', 'New Message')],
  }),
  fixture({
    slug: 'gmail',
    displayName: 'Gmail',
    categories: [PieceCategory.COMMUNICATION],
    actions: [
      action('send_email', 'Send Email'),
      action('request_approval_in_mail', 'Request Approval in Email'),
    ],
    triggers: [trigger('gmail_new_email_received', 'New Email')],
  }),
  fixture({
    slug: 'discord',
    displayName: 'Discord',
    categories: [PieceCategory.COMMUNICATION],
    actions: [action('request_approval_message', 'Request Approval')],
  }),
  fixture({
    slug: 'microsoft-teams',
    displayName: 'Microsoft Teams',
    categories: [PieceCategory.COMMUNICATION],
    actions: [
      action('request_approval_in_channel', 'Request Approval in Channel'),
      action('request_approval_direct_message', 'Request Approval from User'),
    ],
  }),
  fixture({
    slug: 'microsoft-outlook',
    displayName: 'Microsoft Outlook',
    categories: [PieceCategory.COMMUNICATION],
    actions: [action('request_approval_in_mail', 'Request Approval in Mail')],
  }),
  fixture({
    slug: 'telegram-bot',
    displayName: 'Telegram Bot',
    categories: [PieceCategory.COMMUNICATION],
    actions: [action('request_approval_message', 'Request Approval Message')],
  }),
];

const CORE_PIECE_SLUGS = [
  'approval',
  'connections',
  'crypto',
  'csv',
  'data-mapper',
  'data-summarizer',
  'date-helper',
  'delay',
  'file-helper',
  'forms',
  'graphql',
  'http',
  'image-helper',
  'manual-trigger',
  'math-helper',
  'pdf',
  'qrcode',
  'schedule',
  'sftp',
  'smtp',
  'store',
  'subflows',
  'tables',
  'tags',
  'text-helper',
  'webhook',
  'xml',
];

const EXPECTED_CORE_HOMES: Record<string, string[]> = {
  approval: [PieceSelectorTabType.APPROVALS],
  connections: [PieceSelectorTabType.UTILITY],
  crypto: [PieceSelectorTabType.DATA_TRANSFORMATION],
  csv: [PieceSelectorTabType.DATA_TRANSFORMATION],
  'data-mapper': [PieceSelectorTabType.DATA_TRANSFORMATION],
  'data-summarizer': [PieceSelectorTabType.DATA_TRANSFORMATION],
  'date-helper': [PieceSelectorTabType.DATA_TRANSFORMATION],
  delay: [PieceSelectorTabType.FLOW_CONTROL],
  'file-helper': [PieceSelectorTabType.DATA_TRANSFORMATION],
  forms: [PieceSelectorTabType.UTILITY],
  graphql: [PieceSelectorTabType.UTILITY],
  http: [PieceSelectorTabType.UTILITY],
  'image-helper': [PieceSelectorTabType.DATA_TRANSFORMATION],
  'manual-trigger': [],
  'math-helper': [PieceSelectorTabType.DATA_TRANSFORMATION],
  pdf: [PieceSelectorTabType.DATA_TRANSFORMATION],
  qrcode: [PieceSelectorTabType.DATA_TRANSFORMATION],
  schedule: [],
  sftp: [PieceSelectorTabType.UTILITY],
  smtp: [PieceSelectorTabType.UTILITY],
  store: [PieceSelectorTabType.UTILITY],
  subflows: [PieceSelectorTabType.FLOW_CONTROL],
  tables: [PieceSelectorTabType.UTILITY],
  tags: [PieceSelectorTabType.UTILITY],
  'text-helper': [PieceSelectorTabType.DATA_TRANSFORMATION],
  webhook: [PieceSelectorTabType.UTILITY],
  xml: [PieceSelectorTabType.DATA_TRANSFORMATION],
};

type PieceFixture = {
  slug: string;
  displayName: string;
  packageName?: string;
  categories: string[];
  actions: ActionBase[];
  triggers: TriggerBase[];
};
