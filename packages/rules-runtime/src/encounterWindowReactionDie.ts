import type { NativeEncounterActionMechanicsInput } from './encounterActionMechanicsPlan.js'
import { encounterActionSourceLabel } from './encounterActionSources.js'
import { characterClassLevels } from './encounterMovementTargets.js'
import { selectScalingRow } from './scalingRowSelection.js'

/**
 * The die a prepared reaction rolls against another creature's roll (D207): the die its
 * SUBTRACT_FROM_TRIGGERING_ROLL outcome authors, sized by its holder's class level when it grows with
 * one (D168), labelled with the reaction. Null when the reaction rolls no such die.
 */
export function encounterWindowReactionDie(
  prepared: Pick<NativeEncounterActionMechanicsInput['prepared'], 'source' | 'sourceFacts'>
) {
  const { source } = prepared
  if (source.kind !== 'CHARACTER_ACTION') return null
  const rolled = source.candidate.mechanicFacts.outcomes.find(
    (outcome) => outcome.rolledDie !== undefined
  )?.rolledDie
  if (!rolled) return null
  const scaling = rolled.facesScaling
  const row = scaling
    ? selectScalingRow(
        scaling.levels.map((level) => ({ ...level, order: 0 })),
        characterClassLevels(prepared.sourceFacts.characterFacts)[scaling.classId] ?? 0
      )
    : null
  return {
    label: encounterActionSourceLabel(source),
    count: rolled.count,
    faces: row?.faces ?? rolled.faces,
    sign: rolled.sign
  }
}
