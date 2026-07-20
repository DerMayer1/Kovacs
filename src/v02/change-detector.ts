export function frameDifference(previous: Buffer | null, current: Buffer): number {
  if (!previous || previous.length === 0 || previous.length !== current.length) return 1;
  let distance = 0;
  for (let index = 0; index < current.length; index += 1) distance += Math.abs((current[index] ?? 0) - (previous[index] ?? 0));
  return distance / (current.length * 255);
}

export function isMeaningfulFrameChange(previous: Buffer | null, current: Buffer, threshold: number): boolean {
  return frameDifference(previous, current) >= threshold;
}
