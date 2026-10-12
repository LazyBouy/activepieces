import { PieceSelectorConfig } from '@activepieces/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({ t: (key: string) => key }));

import { PieceSelectorTabType } from '@/features/pieces/stores/piece-selector-tabs-provider';
import { pieceSelectorCustomization } from '@/features/pieces/utils/piece-selector-customization';

describe('piece selector categories', () => {
  it('lists the six categories in order with their default names', () => {
    const tabs = pieceSelectorCustomization.buildResolvedTabs({
      availableBuiltinTabs: pieceSelectorCustomization.getCategoryTabs(),
      config: null,
    });
    expect(tabs.map((tab) => [tab.key, tab.name])).toEqual([
      [PieceSelectorTabType.AI_AND_AGENTS, 'AI'],
      [PieceSelectorTabType.APPS, 'Apps'],
      [PieceSelectorTabType.DATA_TRANSFORMATION, 'Transform data'],
      [PieceSelectorTabType.FLOW_CONTROL, 'Flow control'],
      [PieceSelectorTabType.UTILITY, 'Core tools'],
      [PieceSelectorTabType.APPROVALS, 'Human in the loop'],
    ]);
  });

  it('applies a saved configuration with the earlier keys to the categories', () => {
    const config = PieceSelectorConfig.parse(SAVED_CONFIG);
    const tabs = pieceSelectorCustomization.buildResolvedTabs({
      availableBuiltinTabs: pieceSelectorCustomization.getCategoryTabs(),
      config,
    });
    expect(tabs.map((tab) => [tab.key, tab.type, tab.name])).toEqual([
      [PieceSelectorTabType.UTILITY, PieceSelectorTabType.UTILITY, 'Toolbox'],
      [
        PieceSelectorTabType.AI_AND_AGENTS,
        PieceSelectorTabType.AI_AND_AGENTS,
        'AI',
      ],
      [
        PieceSelectorTabType.APPROVALS,
        PieceSelectorTabType.APPROVALS,
        'Human in the loop',
      ],
      ['custom-1', PieceSelectorTabType.CUSTOM, 'Internal tools'],
      [
        PieceSelectorTabType.DATA_TRANSFORMATION,
        PieceSelectorTabType.DATA_TRANSFORMATION,
        'Transform data',
      ],
      [
        PieceSelectorTabType.FLOW_CONTROL,
        PieceSelectorTabType.FLOW_CONTROL,
        'Flow control',
      ],
    ]);
  });

  it('accepts the two new built-in keys and keeps hiding and renaming them', () => {
    const config = PieceSelectorConfig.parse({
      tabs: [
        {
          id: 'FLOW_CONTROL',
          kind: 'BUILTIN',
          builtinTab: 'FLOW_CONTROL',
          title: 'Logic',
          hidden: false,
        },
        {
          id: 'DATA_TRANSFORMATION',
          kind: 'BUILTIN',
          builtinTab: 'DATA_TRANSFORMATION',
          hidden: true,
        },
      ],
    });
    const tabs = pieceSelectorCustomization.buildResolvedTabs({
      availableBuiltinTabs: pieceSelectorCustomization.getCategoryTabs(),
      config,
    });
    expect(tabs.map((tab) => tab.name)).toEqual([
      'Logic',
      'AI',
      'Apps',
      'Core tools',
      'Human in the loop',
    ]);
  });

  it('shows only the custom groups in trigger mode', () => {
    const tabs = pieceSelectorCustomization.buildResolvedTabs({
      availableBuiltinTabs: [],
      config: PieceSelectorConfig.parse(SAVED_CONFIG),
    });
    expect(tabs.map((tab) => tab.key)).toEqual(['custom-1']);
  });

  it('lists the six categories in the editor, without the retired key, keeping saved order', () => {
    expect(
      pieceSelectorCustomization
        .getEditableTabConfigs(PieceSelectorConfig.parse(SAVED_CONFIG))
        .map((tab) => tab.id),
    ).toEqual([
      'APPS',
      'UTILITY',
      'AI_AND_AGENTS',
      'APPROVALS',
      'custom-1',
      'DATA_TRANSFORMATION',
      'FLOW_CONTROL',
    ]);
    expect(
      pieceSelectorCustomization
        .getEditableTabConfigs(null)
        .map((tab) => tab.builtinTab),
    ).toEqual([
      'AI_AND_AGENTS',
      'APPS',
      'DATA_TRANSFORMATION',
      'FLOW_CONTROL',
      'UTILITY',
      'APPROVALS',
    ]);
  });

  it('names each saved key by its category and has no name for the retired key', () => {
    expect(
      ['AI_AND_AGENTS', 'APPS', 'UTILITY', 'APPROVALS', 'EXPLORE'].map((key) =>
        pieceSelectorCustomization.getBuiltinTabDisplay(key),
      ),
    ).toEqual([
      { defaultLabel: 'AI', defaultIconKey: 'Sparkles' },
      { defaultLabel: 'Apps', defaultIconKey: 'Puzzle' },
      { defaultLabel: 'Core tools', defaultIconKey: 'Wrench' },
      { defaultLabel: 'Human in the loop', defaultIconKey: 'UserCheck' },
      undefined,
    ]);
  });
});

const SAVED_CONFIG = {
  tabs: [
    { id: 'EXPLORE', kind: 'BUILTIN', builtinTab: 'EXPLORE', hidden: false },
    { id: 'APPS', kind: 'BUILTIN', builtinTab: 'APPS', hidden: true },
    {
      id: 'UTILITY',
      kind: 'BUILTIN',
      builtinTab: 'UTILITY',
      title: 'Toolbox',
      hidden: false,
    },
    {
      id: 'AI_AND_AGENTS',
      kind: 'BUILTIN',
      builtinTab: 'AI_AND_AGENTS',
      hidden: false,
    },
    {
      id: 'APPROVALS',
      kind: 'BUILTIN',
      builtinTab: 'APPROVALS',
      hidden: false,
    },
    {
      id: 'custom-1',
      kind: 'CUSTOM',
      title: 'Internal tools',
      icon: 'Star',
      hidden: false,
      pieceNames: ['@activepieces/piece-asana'],
      sections: [],
    },
  ],
};
