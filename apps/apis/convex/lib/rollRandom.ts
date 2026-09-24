export function nextRollInt(maxExclusive: number): number {
  const limit = Math.floor(2 ** 32 / maxExclusive) * maxExclusive
  const sample = new Uint32Array(1)
  // Reject the incomplete upper interval so every validated die face is equally likely.
  do {
    crypto.getRandomValues(sample)
  } while (sample[0]! >= limit)
  return sample[0]! % maxExclusive
}
