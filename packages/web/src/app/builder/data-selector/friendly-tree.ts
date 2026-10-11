import { LocalesEnum, isNil, isObject } from '@activepieces/core-utils';
import { PieceMetadataModel } from '@activepieces/pieces-framework';
import {
  FlowAction,
  FlowActionType,
  FlowTrigger,
  FlowTriggerType,
} from '@activepieces/shared';
import { useQueries } from '@tanstack/react-query';
import { t } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { OutputSchema } from '@/components/custom/smart-output-viewer/types';
import { piecesApi } from '@/features/pieces';

import { pathHelpers } from './path-helpers';
import { DataSelectorTreeNode } from './type';
import { dataSelectorUtils } from './utils';
import { schemaTreeUtils } from './utils-schema';

function buildStepNode({
  step,
  sampleData,
  schema,
  zipArraysOfProperties,
  targetStepName,
}: {
  step: StepWithIndex;
  sampleData: Record<string, unknown>;
  schema: OutputSchema | null;
  zipArraysOfProperties: boolean;
  targetStepName: string;
}): DataSelectorTreeNode {
  const displayName = `${step.dfsIndex + 1}. ${step.displayName}`;
  const stepData = sampleData[step.name];
  if (
    typeof stepData === 'string' ||
    typeof stepData === 'number' ||
    typeof stepData === 'boolean'
  ) {
    return buildPrimitiveNode({
      stepName: step.name,
      displayName,
      value: stepData,
    });
  }
  if (Array.isArray(stepData) && stepData.length > 0) {
    return buildArrayNode({
      stepName: step.name,
      displayName,
      items: stepData,
      schema,
    });
  }
  if (schema) {
    return schemaTreeUtils.buildTreeFromSchema({
      stepName: step.name,
      displayName,
      schema,
      sampleData: stepData,
    });
  }
  try {
    return dataSelectorUtils.traverseStep(
      step,
      sampleData,
      zipArraysOfProperties,
      targetStepName,
    );
  } catch {
    return {
      key: `error-${step.name}`,
      data: {
        type: 'chunk',
        displayName: `Error loading ${step.name}`,
      },
    };
  }
}

function buildDataNode({
  stepName,
  displayName,
  data,
  schema,
}: {
  stepName: string;
  displayName: string;
  data: unknown;
  schema: OutputSchema | null;
}): DataSelectorTreeNode {
  if (
    typeof data === 'string' ||
    typeof data === 'number' ||
    typeof data === 'boolean'
  ) {
    return buildPrimitiveNode({ stepName, displayName, value: data });
  }
  if (Array.isArray(data) && data.length > 0) {
    return buildArrayNode({ stepName, displayName, items: data, schema });
  }
  if (schema && isObject(data)) {
    return schemaTreeUtils.buildTreeFromSchema({
      stepName,
      displayName,
      schema,
      sampleData: data,
    });
  }
  return schemaTreeUtils.buildSampleValueNode({
    value: data,
    displayName,
    path: pathHelpers.propertyPathStarter(stepName),
  });
}

function useStepOutputSchemas(
  steps: (FlowAction | FlowTrigger)[],
): Record<string, OutputSchema | null> {
  const { i18n } = useTranslation();
  const piecePairs = useMemo(
    () =>
      steps
        .map((step) => getPiecePair(step))
        .filter((pair): pair is PiecePair => pair !== null),
    [steps],
  );
  const pieces = useQueries({
    queries: piecePairs.map(({ pieceName, pieceVersion }) => ({
      queryKey: ['piece', pieceName, pieceVersion],
      queryFn: () =>
        piecesApi.get({
          name: pieceName,
          version: pieceVersion,
          locale: toLocale(i18n.language),
        }),
      staleTime: Infinity,
    })),
    combine: selectPieceData,
  });
  return useMemo(() => {
    return Object.fromEntries(
      piecePairs.map(({ stepName, stepKey }, index) => [
        stepName,
        findOutputSchema({ piece: pieces[index], stepKey }),
      ]),
    );
  }, [piecePairs, pieces]);
}

function selectPieceData(
  results: { data: PieceMetadataModel | undefined }[],
): (PieceMetadataModel | undefined)[] {
  return results.map((result) => result.data);
}

function buildPrimitiveNode({
  stepName,
  displayName,
  value,
}: {
  stepName: string;
  displayName: string;
  value: string | number | boolean;
}): DataSelectorTreeNode {
  return {
    key: stepName,
    data: {
      type: 'value',
      value: '',
      displayName,
      propertyPath: pathHelpers.propertyPathStarter(stepName),
      insertable: true,
      stepName,
    },
    children: [
      {
        key: `${stepName}_value`,
        data: {
          type: 'value',
          value,
          displayName: t('Result'),
          propertyPath: pathHelpers.propertyPathStarter(stepName),
          insertable: true,
        },
      },
    ],
  };
}

function buildArrayNode({
  stepName,
  displayName,
  items,
  schema,
}: {
  stepName: string;
  displayName: string;
  items: unknown[];
  schema: OutputSchema | null;
}): DataSelectorTreeNode {
  const arrayKind = schemaTreeUtils.selectArrayTreeKind(schema);
  if (schema && arrayKind === 'wrapper') {
    return schemaTreeUtils.buildTreeFromSchema({
      stepName,
      displayName,
      schema,
      sampleData: items,
    });
  }
  if (schema && arrayKind === 'perItem') {
    return schemaTreeUtils.buildTreeFromArrayWithSchema({
      stepName,
      displayName,
      schema,
      items,
    });
  }
  return schemaTreeUtils.buildTreeFromArray({
    stepName,
    displayName,
    items,
  });
}

function getPiecePair(step: FlowAction | FlowTrigger): PiecePair | null {
  if (step.type === FlowActionType.PIECE && step.settings.actionName) {
    return {
      stepName: step.name,
      pieceName: step.settings.pieceName,
      pieceVersion: step.settings.pieceVersion,
      stepKey: step.settings.actionName,
    };
  }
  if (step.type === FlowTriggerType.PIECE && step.settings.triggerName) {
    return {
      stepName: step.name,
      pieceName: step.settings.pieceName,
      pieceVersion: step.settings.pieceVersion,
      stepKey: step.settings.triggerName,
    };
  }
  return null;
}

function findOutputSchema({
  piece,
  stepKey,
}: {
  piece: PieceMetadataModel | undefined;
  stepKey: string;
}): OutputSchema | null {
  if (isNil(piece)) {
    return null;
  }
  return (
    piece.triggers?.[stepKey]?.outputSchema ??
    piece.actions?.[stepKey]?.outputSchema ??
    null
  );
}

function toLocale(language: string): LocalesEnum | undefined {
  return Object.values(LocalesEnum).find((locale) => locale === language);
}

export const friendlyTreeUtils = {
  buildStepNode,
  buildDataNode,
  useStepOutputSchemas,
};

export type StepWithIndex = (FlowAction | FlowTrigger) & { dfsIndex: number };

type PiecePair = {
  stepName: string;
  pieceName: string;
  pieceVersion: string;
  stepKey: string;
};
