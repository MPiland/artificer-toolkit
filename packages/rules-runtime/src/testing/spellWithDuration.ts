import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'

/** `spell` with its one result's duration replaced, so an authored variant reaches a long-lasting plan. */
export function spellWithDuration(
  spell: SpellAuthored,
  duration: { durationKind: 'DAY' | 'MONTH'; amount: number }
): SpellAuthored {
  return {
    ...spell,
    effects: (spell.effects ?? []).map((effect) => ({
      ...effect,
      // The spell's paths are all direct results, which carry a result block.
      paths: effect.paths.map((path) => {
        const { resultBlock } = path as Extract<typeof path, { resultBlock: unknown }>
        return {
          ...path,
          resultBlock: { ...resultBlock, duration: { ...resultBlock.duration, ...duration } }
        }
      })
    }))
  } as SpellAuthored
}
