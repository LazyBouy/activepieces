import { Note, NoteColorVariant } from '@activepieces/shared';
import { describe, expect, it } from 'vitest';

import {
  Box,
  notePlacementUtils,
} from '@/app/builder/flow-canvas/utils/note-placement-utils';

const NODE_HEIGHT = 96;

describe('notePlacementUtils.clearSteps', () => {
  const steps = [
    notePlacementUtils.stepArea({
      position: { x: 176, y: 240 },
      height: NODE_HEIGHT,
    }),
    notePlacementUtils.stepArea({
      position: { x: 400, y: 240 },
      height: NODE_HEIGHT,
    }),
    notePlacementUtils.stepArea({
      position: { x: 624, y: 240 },
      height: NODE_HEIGHT,
    }),
  ];

  it('leaves notes that cover no step where they are', () => {
    const moves = notePlacementUtils.clearSteps({
      notes: [
        note({ id: 'beside', x: 900, y: 240 }),
        note({ id: 'above', x: 176, y: 0 }),
      ],
      steps,
    });

    expect(moves).toEqual([]);
  });

  it('leaves a note over a step label alone; only a note over the step itself moves', () => {
    const moves = notePlacementUtils.clearSteps({
      notes: [
        note({ id: 'label', x: 176, y: 352, width: 96, height: 32 }),
        note({ id: 'step', x: 380, y: 260 }),
      ],
      steps,
    });

    expect(moves.map((move) => move.id)).toEqual(['step']);
  });

  it('moves a covering note to the nearest side of the graph, clear of every step and its label, on the grid', () => {
    const covering = note({
      id: 'covering',
      x: 400,
      y: 280,
      width: 200,
      height: 120,
    });

    const [move] = notePlacementUtils.clearSteps({ notes: [covering], steps });

    expect(move.id).toBe('covering');
    const placed = { ...move.position, width: 200, height: 120 };
    expect(steps.some((step) => overlaps({ a: placed, b: step.area }))).toBe(
      false,
    );
    expect(move.position.x % 16).toBe(0);
    expect(move.position.y % 16).toBe(0);
    expect(Math.abs(move.position.y - covering.position.y)).toBeLessThan(400);
  });

  it('places several covering notes without stacking them on each other or on notes that stay', () => {
    const staying = note({
      id: 'staying',
      x: 400,
      y: 64,
      width: 200,
      height: 120,
    });
    const notes = [
      staying,
      note({ id: 'first', x: 176, y: 240, width: 200, height: 120 }),
      note({ id: 'second', x: 400, y: 240, width: 200, height: 120 }),
      note({ id: 'third', x: 624, y: 240, width: 200, height: 120 }),
    ];

    const moves = notePlacementUtils.clearSteps({ notes, steps });

    expect(moves.map((move) => move.id)).toEqual(['first', 'second', 'third']);
    const placed = moves.map((move) => ({
      ...move.position,
      width: 200,
      height: 120,
    }));
    const fixed = [...steps.map((step) => step.area), boxOf({ note: staying })];
    placed.forEach((box, index) => {
      expect(fixed.some((other) => overlaps({ a: box, b: other }))).toBe(false);
      expect(
        placed.some(
          (other, otherIndex) =>
            otherIndex !== index && overlaps({ a: box, b: other }),
        ),
      ).toBe(false);
    });
  });

  it('does nothing in a flow without steps', () => {
    expect(
      notePlacementUtils.clearSteps({
        notes: [note({ id: 'alone', x: 0, y: 0 })],
        steps: [],
      }),
    ).toEqual([]);
  });
});

function note({
  id,
  x,
  y,
  width = 160,
  height = 100,
}: {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}): Note {
  return {
    id,
    content: id,
    ownerId: null,
    color: NoteColorVariant.YELLOW,
    position: { x, y },
    size: { width, height },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function boxOf({ note: value }: { note: Note }): Box {
  return { ...value.position, ...value.size };
}

function overlaps({ a, b }: { a: Box; b: Box }): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}
