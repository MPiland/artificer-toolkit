import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'

import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscoveryRegistry.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { chosenZonePlacement } from '../encounterZonePlacement.js'
import { testUuid } from './dnd5eSrdEncounter.js'
import { evaluateSrdCharacter } from './dnd5eSrdCharacter.js'

const CALTROPS = 'Caltrops (bag of 20)'

/**
 * A Character carrying an item (real SRD Caltrops unless a further authored record is given),
 * compiled through the real policy and entry compiler.
 */
export function compileItemEntry(equipment?: EquipmentAuthored) {
  const label = equipment?.label ?? CALTROPS
  const character = evaluateSrdCharacter({
    abilities: { DEXTERITY: 14 },
    classes: [{ label: 'Fighter', level: 1 }],
    items: [{ label }],
    ...(equipment ? { extraEquipment: [equipment] } : {})
  })
  const itemInstanceId = character.itemInstanceId(label)
  const candidate = character.facts.actionCandidates.find(
    (entry) => entry.equipment?.itemInstanceId === itemInstanceId
  )
  if (!candidate) throw new Error('The item must offer an action.')
  const entry = compileCharacterActionEntryPoints({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: character.facts.actionCandidates,
    descriptors: discoverCharacterActionCapabilities({
      gameSystemId: SRD_SYSTEM_ID,
      candidates: character.facts.actionCandidates,
      conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
      abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
      entryPoints: character.entryPoints
    })
  }).find((compiled) => compiled.actionId === candidate.actionId)
  if (entry?.kind !== 'CHARACTER_ACTION') throw new Error('The item must compile an action entry.')
  return entry
}

export function compileCaltropsEntry(equipment?: EquipmentAuthored) {
  const entry = compileItemEntry(equipment)
  if (entry.schemaVersion !== 4)
    throw new Error('Caltrops must compile to a v4 Character action entry.')
  if (entry.compilation.kind !== 'COMPILED')
    throw new Error('Caltrops must compile, not go manual.')
  return { entry, compilation: entry.compilation }
}

const VARIANT_ID = testUuid(0x1790)
const VARIANT_LABEL = 'Spike field (bag)'
export const extraId = (offset: number) => testUuid(0x1800 + offset)

/** The pieces of the one zone action Caltrops authors, found by narrowing the authored record. */
export function zoneParts(equipment: EquipmentAuthored) {
  const effect = equipment.effects?.[0]
  const path = effect?.paths[0]
  const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  if (!effect || outcome?.effectKind !== 'MANIFEST' || outcome.manifestKind !== 'ZONE')
    throw new Error('The record must author a zone action.')
  const component = outcome.components?.[0]
  const behavior = component?.behaviors?.[0]
  const savePath = behavior?.paths[0]
  const invocation = behavior?.invocation
  if (
    !component ||
    !behavior ||
    savePath?.selectionKind !== 'FIXED' ||
    !invocation ||
    !('savingThrow' in invocation)
  )
    throw new Error('The zone must author one saving-throw behavior.')
  return { effect, zone: outcome, component, behavior, savePath, invocation }
}
export type ZoneParts = ReturnType<typeof zoneParts>

/** A copy of the real SRD Caltrops record, edited and given an identity of its own. */
export function variantEquipment(change: (parts: ZoneParts) => void): EquipmentAuthored {
  const equipment: EquipmentAuthored = {
    ...structuredClone(caltropsBagOf20),
    id: VARIANT_ID,
    label: VARIANT_LABEL
  }
  change(zoneParts(equipment))
  return equipment
}

export function zonePlacementOf(equipment?: EquipmentAuthored) {
  const placement = compileCaltropsEntry(equipment).compilation.zonePlacement
  const zone = placement && chosenZonePlacement(placement, undefined)
  if (!zone) throw new Error('The item must place one zone.')
  return zone
}

/** The authored zone damage, as dice instead of the fixed amount. */
export function diceDamage(diceConfig: string, change?: (damage: Record<string, unknown>) => void) {
  return ({ savePath }: ZoneParts) => {
    const damage = savePath.resultBlock.outcomes.find((outcome) => outcome.effectKind === 'DAMAGE')
    if (!damage) throw new Error('The zone must author damage.')
    const authored: Record<string, unknown> = damage
    delete authored.amount
    Object.assign(authored, { valueKind: 'DICE', diceConfig })
    change?.(authored)
  }
}

type FailedSaveOutcome = ZoneParts['savePath']['resultBlock']['outcomes'][number]

/** A failed-save outcome that costs the target its Action for the turn (D141). */
export const lostActionOutcome = (offset = 20): FailedSaveOutcome => ({
  id: extraId(offset),
  effectKind: 'ACTION_ECONOMY_RULE',
  ruleKind: 'LOSE_ACTION'
})

/** The zone's failed save also costs the target its Action. */
export function losesAction({ savePath }: ZoneParts) {
  savePath.resultBlock.outcomes.push(lostActionOutcome())
}

/** The zone's failed save has only `outcomes`; the grant's lifetime goes with the grant. */
export function failedSaveOnly(...outcomes: FailedSaveOutcome[]) {
  return ({ savePath }: ZoneParts) => {
    savePath.resultBlock.outcomes = outcomes
    if (!outcomes.some((outcome) => outcome.effectKind === 'APPLY_GRANT'))
      delete savePath.resultBlock.lifecycle
  }
}
