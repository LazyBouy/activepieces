const StepNodeSkippedLine = () => {
  return (
    <div
      data-step-skipped-line
      className="pointer-events-none absolute top-1/2 -right-2 -left-1 h-0.5 -translate-y-1/2 bg-canvas-skipped-line"
    />
  );
};

StepNodeSkippedLine.displayName = 'StepNodeSkippedLine';
export { StepNodeSkippedLine };
