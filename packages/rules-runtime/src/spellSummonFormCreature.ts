import {
  ACTIVATION_CODE,
  CREATURE_CATEGORY_CODE,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  evaluateNumericExpr,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SCALING,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type NumericExpr
} from '@artificer-toolkit/shared/core'
import type { SummonStatBlockDto } from '@artificer-toolkit/schema/effects/manifest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { EncounterActorFormCreature } from './encounterActorForm.js'
import { armorClassCapabilityRegistry } from './platformPolicyModules.js'
import { compileInstalledCreatureRuleFacts } from './platformRulesRuntime.js'

type SummonAttack = NonNullable<SummonStatBlockDto['attacks']>[number]
type CreatureFeature = CreatureAuthored['features'][number]

/**
 * A part of an authored attack's feature (its effect, roll, range, path or outcome) takes the
 * attack's own id with its first eight digits replaced by the part's number, so every part has a
 * stable id of its own across casts.
 */
function attackPartId(attackId: string, part: number) {
  return `${part.toString(16).padStart(8, '0')}${attackId.slice(8)}`
}

/** The Creature Feature an authored summon attack becomes: one melee weapon attack action. */
function summonAttackFeature(attack: SummonAttack): CreatureFeature {
  return {
    id: attack.id,
    label: attack.label,
    description: `Melee Weapon Attack: +${attack.attackBonus} to hit, reach ${attack.reachFeet} ft., one target. Hit: ${attack.diceConfig} damage.`,
    order: attack.order,
    rollDefinitions: [
      {
        id: attackPartId(attack.id, 1),
        label: `${attack.label} attack`,
        kind: 'ATTACK',
        expression: { count: 1, die: 20, modifier: attack.attackBonus },
        rollMode: 'NORMAL',
        chargeCost: null,
        order: 1
      }
    ],
    effects: [
      {
        id: attackPartId(attack.id, 2),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: {
            id: attackPartId(attack.id, 3),
            rangeKind: RANGE_KIND.DISTANCE,
            amount: attack.reachFeet,
            unit: MEASUREMENT_UNIT_CODE.FEET
          },
          targeting: {
            selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
            dispositionKind: TARGET_DISPOSITION_KIND.ANY
          }
        },
        paths: [
          {
            id: attackPartId(attack.id, 4),
            order: 1,
            pathCode: PATH_CODE.ON_HIT,
            groupType: PATH_GROUP_TYPE.SINGLE,
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: `${attackPartId(attack.id, 4)}__result`,
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: attackPartId(attack.id, 5),
                  effectKind: EFFECT_KIND.DAMAGE,
                  damageTypeId: attack.damageTypeId,
                  valueKind: DAMAGE_VALUE_KIND.DICE,
                  scalingKind: SCALING.NONE,
                  diceConfig: attack.diceConfig
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

/**
 * The Creature a summon form conjures from its own authored stat block, where no System Creature
 * exists for it: its size, ability scores, hit points, speeds and defenses, and one Creature
 * action for each attack the stat block authors, so the creature attacks through the same offers
 * as any other Creature. The stat block's armor class is the one it prints, so the Creature's
 * natural armor is what its System's armor class formula leaves to reach it. The Worker's plan
 * (with its rule facts compiled from this) and the Sheet's Convex command build it alike.
 */
export function summonFormCreature(input: {
  form: { id: string; label: string; statBlock: SummonStatBlockDto }
  systemId: string
  userId: string
}): CreatureAuthored {
  const { form, systemId, userId } = input
  const { statBlock } = form
  // A form's values are fixed: one that reads the caster has no value before the cast.
  const evaluate = (expr: unknown, name: string) => {
    const value = evaluateNumericExpr(expr as NumericExpr, {})
    if (value === null) throw new Error(`The summon form's ${name} is not a fixed value.`)
    return value
  }
  const { creatureTypeId, size, hitPoints, armorClass } = statBlock
  if (!creatureTypeId || !size || !hitPoints || !statBlock.abilityScores)
    throw new Error('A summon form authors its creature type, size, hit points and ability scores.')
  const abilityScores = Object.fromEntries(
    Object.entries(statBlock.abilityScores).map(([ability, expr]) => [
      ability,
      evaluate(expr, 'ability score')
    ])
  )
  const base = armorClassCapabilityRegistry
    .require(systemId)
    .creatureArmorClass({ abilityScores, naturalArmorBonus: 0, equipment: [] })
  if (!base?.ok) throw new Error(base?.reason ?? "The summon form's armor class is not computable.")
  const naturalArmorBonus =
    armorClass === undefined ? 0 : evaluate(armorClass, 'armor class') - base.armorClass
  if (naturalArmorBonus < 0)
    throw new Error("A summon form's armor class is below what its ability scores give it.")
  return {
    id: form.id,
    label: form.label,
    userId,
    systemId,
    category: CREATURE_CATEGORY_CODE.SUMMON,
    creatureTypeId,
    size,
    details: [],
    features: (statBlock.attacks ?? []).map(summonAttackFeature),
    proficiencies: [],
    speeds: statBlock.speeds ?? [],
    abilityScores,
    naturalArmorBonus,
    hitPoints: evaluate(hitPoints, 'hit points'),
    senses: [],
    ...(statBlock.passivePerception === undefined
      ? {}
      : { passivePerception: evaluate(statBlock.passivePerception, 'passive perception') }),
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    qualifiedDamageDefenses: [],
    conditionImmunities: []
  }
}

/**
 * The form's Creature as an Encounter actor holds it: the snapshot a System Creature would pin,
 * with the rule facts its attacks compile to. The form stands in for the Creature's source, so its
 * own id is the actor's source id.
 */
export function summonFormActorCreature(
  input: Parameters<typeof summonFormCreature>[0] & { vocabulary: SystemVocabularySnapshot }
): EncounterActorFormCreature {
  const creature = summonFormCreature(input)
  const maxHitPoints = Math.max(creature.hitPoints, 0)
  return {
    systemId: creature.systemId,
    sourceId: creature.id,
    sourceRevision: 1,
    maxHitPoints,
    snapshot: jsonValueSchema.parse({
      kind: 'CREATURE',
      id: creature.id,
      label: creature.label,
      systemId: creature.systemId,
      sourceRevision: 1,
      maxHitPoints,
      payload: creature,
      ruleFacts: compileInstalledCreatureRuleFacts({ creature, vocabulary: input.vocabulary })
    })
  }
}
