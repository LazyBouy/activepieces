import { flowLayoutUtil, Note } from '@activepieces/shared';

function stepArea({
  position,
  height,
}: {
  position: Point;
  height: number;
}): StepArea {
  return {
    node: { ...position, width: flowLayoutUtil.constants.NODE, height },
    area: {
      x: position.x - LABEL_SIDE,
      y: position.y,
      width: flowLayoutUtil.constants.NODE + LABEL_SIDE * 2,
      height: height + LABEL_BELOW,
    },
  };
}

function clearSteps({
  notes,
  steps,
}: {
  notes: Note[];
  steps: StepArea[];
}): NoteMove[] {
  if (steps.length === 0) {
    return [];
  }
  const areas = steps.map((step) => step.area);
  const graph = boundsOf({ boxes: areas });
  const covering = notes.filter((note) =>
    steps.some((step) => overlaps({ a: boxOf({ note }), b: step.node })),
  );
  const staying = notes
    .filter((note) => !covering.includes(note))
    .map((note) => boxOf({ note }));
  return covering.reduce<{ moves: NoteMove[]; taken: Box[] }>(
    (placed, note) => {
      const position = freePlace({ note, graph, taken: placed.taken });
      const box = {
        ...position,
        width: note.size.width,
        height: note.size.height,
      };
      return {
        moves: [...placed.moves, { id: note.id, position }],
        taken: [...placed.taken, box],
      };
    },
    { moves: [], taken: [...areas, ...staying] },
  ).moves;
}

function freePlace({
  note,
  graph,
  taken,
}: {
  note: Note;
  graph: Box;
  taken: Box[];
}): Point {
  const { width, height } = note.size;
  const sides = sidesOf({ note, graph });
  const nearest = [...sides].sort(
    (left, right) =>
      distance({ from: note.position, to: left.start }) -
      distance({ from: note.position, to: right.start }),
  );
  for (const side of nearest) {
    for (let attempt = 0; attempt < MAX_SLIDES; attempt++) {
      const candidate = {
        x: snap(side.start.x + side.slide.x * attempt),
        y: snap(side.start.y + side.slide.y * attempt),
      };
      const box = { ...candidate, width, height };
      if (!taken.some((other) => overlaps({ a: box, b: other }))) {
        return candidate;
      }
    }
  }
  return { x: snap(graph.x), y: snap(graph.y + graph.height + GAP) };
}

function sidesOf({ note, graph }: { note: Note; graph: Box }): Side[] {
  const { width, height } = note.size;
  const x = clamp({
    value: note.position.x,
    min: graph.x,
    max: graph.x + graph.width - width,
  });
  const y = clamp({
    value: note.position.y,
    min: graph.y,
    max: graph.y + graph.height - height,
  });
  return [
    {
      start: { x, y: graph.y - height - GAP },
      slide: { x: width + GAP, y: 0 },
    },
    {
      start: { x, y: graph.y + graph.height + GAP },
      slide: { x: width + GAP, y: 0 },
    },
    {
      start: { x: graph.x - width - GAP, y },
      slide: { x: 0, y: height + GAP },
    },
    {
      start: { x: graph.x + graph.width + GAP, y },
      slide: { x: 0, y: height + GAP },
    },
  ];
}

function boxOf({ note }: { note: Note }): Box {
  return { ...note.position, width: note.size.width, height: note.size.height };
}

function boundsOf({ boxes }: { boxes: Box[] }): Box {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function overlaps({ a, b }: { a: Box; b: Box }): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function distance({ from, to }: { from: Point; to: Point }): number {
  return Math.hypot(from.x - to.x, from.y - to.y);
}

function clamp({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function snap(value: number): number {
  return (
    Math.round(value / flowLayoutUtil.constants.GRID) *
    flowLayoutUtil.constants.GRID
  );
}

const LABEL_SIDE = 56;

const LABEL_BELOW = 56;

const GAP = 32;

const MAX_SLIDES = 50;

export const notePlacementUtils = {
  stepArea,
  clearSteps,
};

export type Point = { x: number; y: number };

export type Box = Point & { width: number; height: number };

export type StepArea = { node: Box; area: Box };

export type NoteMove = { id: string; position: Point };

type Side = { start: Point; slide: Point };
