/** The size of a class hit die (`d10`, `1d10`); null when the config is not a single hit die. */
export function parseHitDie(dieConfig: string | undefined): number | null {
  const match = /^(?:1)?d([1-9]\d*)$/i.exec(dieConfig?.trim() ?? '')
  if (!match?.[1]) return null

  const die = Number(match[1])
  return Number.isSafeInteger(die) ? die : null
}

/** The fixed value a hit die gives at levels after the first. */
export function hitDieAverage(die: number): number {
  return Math.floor(die / 2) + 1
}

/**
 * The hit points one Character level adds, before any other modifier. The first level takes the
 * die maximum; later levels take the fixed average, or the rolled value (a roll of 1 until one is
 * entered) when hit points are rolled.
 */
export function hitPointGain(input: {
  die: number
  characterLevel: number
  fixed: boolean
  roll: number | null
  modifier: number
}): number {
  const base =
    input.characterLevel === 1
      ? input.die
      : input.fixed
        ? hitDieAverage(input.die)
        : (input.roll ?? 1)
  return Math.max(base + input.modifier, 1)
}
