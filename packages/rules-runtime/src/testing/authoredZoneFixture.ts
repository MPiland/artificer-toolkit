import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { ManifestAuthored } from '@artificer-toolkit/shared/authored'
import type {
  CreatureAuthored,
  EquipmentAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'

import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
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
  return { effect, ...zoneBehaviorParts(outcome) }
}
export type ZoneParts = ReturnType<typeof zoneParts>

/** The one saving-throw behavior of an authored zone, found by narrowing it. */
function zoneBehaviorParts(zone: Extract<ManifestAuthored, { manifestKind: 'ZONE' }>) {
  const component = zone.components?.[0]
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
  return { zone, component, behavior, savePath, invocation }
}

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

/**
 * The environmental zones a GM builds with the zone node map (MOVE-3.2): the SRD caltrop field
 * as authored, and a pit authored from the same core options. A creature that enters the 10-foot
 * pit and fails a DC 10 Dexterity save stops, takes 3 bludgeoning damage and falls prone.
 */
export function environmentalZones() {
  const caltropField = zoneParts(structuredClone(caltropsBagOf20)).zone
  const pit = structuredClone(caltropField)
  const { component, savePath, invocation } = zoneBehaviorParts(pit)
  const stop = savePath.resultBlock.outcomes.find(
    (outcome) => outcome.effectKind === 'MOVEMENT_RULE'
  )
  const damage = savePath.resultBlock.outcomes.find((outcome) => outcome.effectKind === 'DAMAGE')
  if (
    !stop ||
    damage?.effectKind !== 'DAMAGE' ||
    damage.valueKind !== 'FIXED' ||
    invocation.savingThrow?.dcMethod !== 'FIXED_DC'
  )
    throw new Error(
      'The caltrop field must stop and damage the creature that fails a fixed-DC save.'
    )
  Object.assign(pit, { id: extraId(40), label: 'Pit' })
  pit.shape = { id: extraId(41), shapeKind: 'CUBE', edgeLength: { amount: 10, unit: 'FEET' } }
  Object.assign(component, { id: extraId(42), label: 'Fall into the pit' })
  delete component.bypassAtHalfSpeed
  invocation.savingThrow = { ...invocation.savingThrow, baseDc: 10 }
  delete savePath.resultBlock.lifecycle
  savePath.resultBlock.outcomes = [
    stop,
    {
      ...damage,
      id: extraId(43),
      damageTypeId: damageTypeIdOf('BLUDGEONING'),
      usesTriggeringWeaponDamageType: false,
      amount: 3
    },
    { id: extraId(44), effectKind: 'CONDITION', conditionId: conditionIdOf('PRONE') }
  ]
  return { caltropField, pit }
}

/** An item whose one action places `zone`, as the SRD Caltrops places its field. */
export function carryingZone(zone: ZoneParts['zone']): EquipmentAuthored {
  return variantEquipment(({ effect }) => {
    const path = effect.paths[0]
    if (path?.selectionKind !== 'FIXED') throw new Error('Caltrops must author one fixed path.')
    path.resultBlock.outcomes = [zone]
  })
}

const damageTypeIdOf = (code: string) =>
  SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)!.id
const conditionIdOf = (code: string) =>
  SRD_CONDITION_TYPES.find((condition) => condition.code === code)!.id

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

/**
 * The zone's outcome needs no save (D144): its behavior deals the authored damage on use, acting at
 * the start of its source's turn unless `interactionKinds` says otherwise.
 */
export function noSave(
  interactionKinds: NonNullable<ZoneParts['component']['interactionKinds']> = [
    'START_OF_SOURCE_TURN'
  ]
) {
  return ({ component, behavior, savePath, invocation }: ZoneParts) => {
    component.interactionKinds = interactionKinds
    delete component.bypassAtHalfSpeed
    behavior.invocation = { kind: 'PASSIVE', triggerCode: 'ACTIVATED', range: invocation.range }
    savePath.pathCode = 'ON_USE'
    savePath.resultBlock.outcomes = savePath.resultBlock.outcomes.filter(
      (outcome) => outcome.effectKind === 'DAMAGE'
    )
    delete savePath.resultBlock.lifecycle
  }
}

type CreatureFeature = NonNullable<CreatureAuthored['features']>[number]
const auraId = (offset: number) => testUuid(0x1900 + offset)
const FIRE = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === 'FIRE')!.id

/**
 * A Creature feature authored from core options (D144): a passive zone of `radiusFeet` around the
 * Creature dealing `diceConfig` fire damage, with no save, to each other creature in it at the
 * start of the Creature's turn, or on each of `interactionKinds`.
 */
export function creatureAuraFeature(
  diceConfig = '1d6',
  radiusFeet = 5,
  interactionKinds: NonNullable<ZoneParts['component']['interactionKinds']> = [
    'START_OF_SOURCE_TURN'
  ]
): CreatureFeature {
  const self = (offset: number) => ({ id: auraId(offset), rangeKind: 'SELF' as const })
  const shape = (offset: number) => ({
    id: auraId(offset),
    shapeKind: 'SPHERE' as const,
    radius: { amount: radiusFeet, unit: 'FEET' as const }
  })
  return {
    id: auraId(1),
    label: 'Searing Aura',
    description:
      'Searing Aura. At the start of its turn, each creature within 5 feet of it takes fire damage.',
    order: 99,
    effects: [
      {
        id: auraId(2),
        order: 1,
        invocation: {
          kind: 'PASSIVE',
          triggerCode: 'ACTIVATED',
          range: self(3),
          targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' },
          shape: shape(4)
        },
        paths: [
          {
            id: auraId(5),
            order: 1,
            pathCode: 'ON_USE',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: `${auraId(5)}__result`,
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: auraId(6),
                  effectKind: 'MANIFEST',
                  manifestKind: 'ZONE',
                  attachmentKind: 'SOURCE',
                  label: 'Searing Aura',
                  shape: shape(7),
                  components: [
                    {
                      id: auraId(8),
                      order: 1,
                      label: 'Searing heat',
                      interactionKinds,
                      behaviors: [
                        {
                          id: auraId(9),
                          order: 1,
                          invocation: {
                            kind: 'PASSIVE',
                            triggerCode: 'ACTIVATED',
                            range: self(10)
                          },
                          paths: [
                            {
                              id: auraId(11),
                              order: 1,
                              pathCode: 'ON_USE',
                              groupType: 'SINGLE',
                              originKind: 'SOURCE',
                              selectionKind: 'FIXED',
                              resultBlock: {
                                id: `${auraId(11)}__result`,
                                resultKind: 'SINGLE',
                                outcomes: [
                                  {
                                    id: auraId(12),
                                    effectKind: 'DAMAGE',
                                    damageTypeId: FIRE,
                                    valueKind: 'DICE',
                                    diceConfig,
                                    scalingKind: 'NONE'
                                  }
                                ]
                              }
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

/** An SRD Creature record given one more feature, as a homebrew copy of it would be. */
export function withFeature(
  creature: CreatureAuthored,
  feature: CreatureFeature
): CreatureAuthored {
  return { ...creature, features: [...(creature.features ?? []), feature] }
}
