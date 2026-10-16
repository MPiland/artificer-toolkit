import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

export function frightenedId() {
  const condition = srdSystemRecord.conditionTypes.find(({ code }) => code === 'FRIGHTENED')
  if (!condition) throw new Error('The SRD vocabulary has no Frightened condition.')
  return condition.id
}

/** A failed save frightens for two rounds; the creature saves again at the end of each of its turns. */
export function frightenedResultBlock() {
  return {
    id: '00000000-0000-4000-8000-0000000000c1',
    resultKind: 'SEQUENCE' as const,
    duration: {
      id: '00000000-0000-4000-8000-0000000000c2',
      durationKind: 'ROUND' as const,
      amount: 2
    },
    outcomes: [
      {
        id: '00000000-0000-4000-8000-0000000000c3',
        effectKind: 'CONDITION' as const,
        conditionId: frightenedId()
      },
      {
        id: '00000000-0000-4000-8000-0000000000c4',
        effectKind: 'FOLLOW_UP_SAVE' as const,
        timing: 'TARGET_TURN_END' as const,
        savingThrow: {
          id: '00000000-0000-4000-8000-0000000000c5',
          dcMethod: 'FIXED_DC' as const,
          abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
          baseDc: 10
        },
        attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
        onSuccess: { kind: 'END' as const },
        onFailure: { kind: 'CONTINUE' as const },
        onDurationComplete: { kind: 'END' as const }
      }
    ]
  }
}

/**
 * Fireball's point sphere and Dexterity save at 1st level, whose failed save frightens instead of
 * burning and which the caster maintains with Concentration.
 */
export function concentrationFrightSphere(): SpellAuthored {
  const spell = structuredClone(fireball)
  const effect = spell.effects?.[0]
  const path = effect?.paths?.[0]
  if (!effect || !path || !('resultBlock' in path)) throw new Error('Fireball has a result block.')
  path.resultBlock = frightenedResultBlock()
  effect.paths = [path]
  return {
    ...spell,
    id: '00000000-0000-4000-8000-0000000000d1',
    label: 'Fright Sphere',
    level: 1,
    attributes: holdPerson.attributes
  }
}
