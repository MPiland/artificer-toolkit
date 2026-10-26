import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareNativeCharacterActionState } from '../character/characterNativeActionResources.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import {
  buildCompiledActionCompilerSource,
  compileCharacterActionEntryPoints
} from '../encounterActionEntryPointCompiler.js'
import type { CharacterRuleActionApplication } from '../characterRuleActionSystemAdapter.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { optionalSmite } from '../testing/optionalSmite.js'
import {
  SRD,
  evaluateSrdCharacter,
  itemAction,
  srdByLabel,
  type SrdCharacter
} from '../testing/dnd5eSrdCharacter.js'

export const SMITE_TARGET_ID = testUuid(0xc2)
export const SMITE_OCCURRENCE_ID = testUuid(0xc3)
/** Ordinary and natural-20 d20 faces (0-based), against the target's Armor Class 11. */
export const HIT = 14
export const MISS = 0
export const NATURAL_20 = 19
const FIGHTER = srdByLabel(SRD.classes, 'Fighter')

/** A Fighter who carries the optional rider (the smite unless another Feature is given) and wields the given equipped weapon. */
export function smiter(weaponLabel: string, rider: FeatureAuthored = optionalSmite()) {
  return evaluateSrdCharacter({
    abilities: { STRENGTH: 16, DEXTERITY: 16 },
    classes: [{ label: 'Fighter', level: 5 }],
    items: [{ label: weaponLabel, equipped: true }],
    extraFeatures: [rider],
    features: [
      {
        acquisitionId: 'acquired:optional-smite',
        featureId: rider.id,
        source: { kind: 'CLASS', classId: FIGHTER.id, classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL', classId: FIGHTER.id, classLevel: 1 }
      }
    ]
  })
}

export function smiteRuntime() {
  return createPlatformRulesRuntime({
    definitions: {
      async requireCurrent() {
        throw new Error('Definitions are not used by sealed graphs.')
      }
    }
  })
}

/**
 * The weapon attack prepared as the Sheet would offer it, before any rider is chosen. The wielder is
 * the Fighter with the homebrew smite unless another Character is given.
 */
export function smiterWeaponAttack(
  weaponLabel: string,
  action: Parameters<typeof itemAction>[2],
  character: SrdCharacter = smiter(weaponLabel)
) {
  const { candidate, decision } = itemAction(character, weaponLabel, action)
  const descriptors = discoverCharacterActionCapabilities({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: character.facts.actionCandidates,
    conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    entryPoints: character.entryPoints
  })
  const index = character.facts.actionCandidates.indexOf(candidate)
  const descriptor = descriptors[index]
  const entry = compileCharacterActionEntryPoints({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: character.facts.actionCandidates,
    descriptors
  })[index]
  if (!descriptor || entry?.kind !== 'CHARACTER_ACTION' || entry.schemaVersion !== 4)
    throw new Error('The weapon attack must compile to a v4 Character action.')
  if (entry.compilation.kind !== 'COMPILED') throw new Error('The weapon attack must compile.')
  const compilerSource = buildCompiledActionCompilerSource(descriptor)
  const plan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action: descriptor,
    compilerSource
  })
  if (!plan) throw new Error('The weapon attack has no execution plan.')
  const { actionMechanic } = prepareNativeCharacterActionState({
    entry: { ...entry, compilation: entry.compilation },
    candidate,
    policyOutput: character.output,
    resourceUsage: [],
    inventory: [],
    itemUsage: [],
    characterId: 'srd-character',
    expectedStreamVersion: 0,
    classLevels: character.facts.grantFoldFacts.base.classes,
    automationMode: 'ASSISTED',
    trackAmmunition: false,
    ammunition: null,
    overridable: false
  })
  return { plan, actionMechanic, compilerSource, decision }
}

/** The attack's binding against the target (Armor Class 11), the attacker's rider choice not yet made. */
export function smiteTargetBinding(
  actionMechanic: ReturnType<typeof smiterWeaponAttack>['actionMechanic'],
  options: { resistantTo?: string; creatureTypeId?: string } = {}
) {
  return {
    actionMechanic,
    sourceDerivedFacts: {},
    targetActorId: SMITE_TARGET_ID,
    targetDerivedFacts: {
      statBlock: { armorClass: 11 },
      ...(options.creatureTypeId ? { creatureTypeId: options.creatureTypeId } : {})
    },
    targetConditionIds: [],
    currentHitPoints: 59,
    temporaryHitPoints: 0,
    maximumHitPoints: 59,
    targetScalarValues: {},
    defenses: options.resistantTo
      ? [{ kind: 'RESISTANCE' as const, damageTypeId: options.resistantTo }]
      : []
  }
}

/** A random source that yields the listed 0-based values in order and fails on any other roll. */
export function scriptedRolls(values: readonly number[]) {
  const remaining = [...values]
  return {
    next: (maxExclusive: number) => {
      const value = remaining.shift()
      if (value === undefined || value >= maxExclusive)
        throw new Error(`Unexpected random call (max ${maxExclusive}).`)
      return value
    },
    remaining: () => remaining
  }
}

/** The damage a completed action applies, in application order. */
export function damage(execution: { applications: readonly CharacterRuleActionApplication[] }) {
  return execution.applications.flatMap((application) =>
    application.kind === 'DAMAGE'
      ? [
          {
            requested: application.requestedAmount,
            resolved: application.resolvedAmount,
            damageTypeId: application.damageTypeId
          }
        ]
      : []
  )
}
