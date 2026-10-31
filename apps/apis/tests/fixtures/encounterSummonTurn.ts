import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'

/** A spell copy whose summon acts right after its owner, so it takes a turn of its own (SPELLS-35). */
export function summonActsAfterOwner(payload: Record<string, unknown>): Record<string, unknown> {
  const spell = spellAuthoredDtoSchema.parse(payload)
  return {
    ...payload,
    effects: spell.effects?.map((effect) => ({
      ...effect,
      paths: effect.paths?.map((path) =>
        'resultBlock' in path
          ? {
              ...path,
              resultBlock: {
                ...path.resultBlock,
                outcomes: path.resultBlock.outcomes.map((outcome) =>
                  outcome.effectKind === 'MANIFEST' && outcome.manifestKind === 'SUMMON'
                    ? { ...outcome, turnTiming: 'AFTER_OWNER' as const }
                    : outcome
                )
              }
            }
          : path
      )
    }))
  }
}
