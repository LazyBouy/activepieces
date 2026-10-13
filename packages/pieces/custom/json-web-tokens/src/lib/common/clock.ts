function now(): number {
  return Date.now();
}

function nowInSeconds(): number {
  return Math.floor(clock.now() / 1000);
}

export const clock = {
  now,
  nowInSeconds,
};
