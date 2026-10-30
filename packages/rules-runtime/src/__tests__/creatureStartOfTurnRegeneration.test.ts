import { describe, expect, it } from 'vitest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { compileEncounterFeatureActionPlan } from '../encounterActionEntryPointCompiler.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const ACTOR_ID = testUuid(0x4a01)
const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const abilityDefinitions = (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))

type Feature = NonNullable<CreatureAuthored['features']>[number]
type Path = NonNullable<NonNullable<Feature['effects']>[number]['paths']>[number]
type FixedPath = Extract<Path, { selectionKind: 'FIXED' }>
type Outcome = FixedPath['resultBlock']['outcomes'][number]
type ResultBlock = FixedPath['resultBlock']
const damageTypeId = (code: string) => {
  const id = srdSystemRecord.damageTypes.find((type) => type.code === code)?.id
  if (!id) throw new Error(`SRD damage type "${code}" is missing.`)
  return id
}

/** An SRD Creature whose Regeneration outcomes are rewritten the way a homebrew author would. */
function discoverRegeneration(
  label: string,
  rewrite?: (outcomes: Outcome[]) => Outcome[],
  rewriteBlock?: (block: ResultBlock) => ResultBlock
) {
  const srd = srdBaselineContent.subjects.creatures.find((entry) => entry.label === label)
  if (!srd) throw new Error(`SRD Creature "${label}" is missing.`)
  const creature =
    rewrite || rewriteBlock
      ? {
          ...srd,
          features: srd.features?.map((feature) =>
            feature.label !== 'Regeneration'
              ? feature
              : {
                  ...feature,
                  effects: feature.effects?.map((effect) => ({
                    ...effect,
                    paths: effect.paths.map((path) =>
                      path.selectionKind === 'FIXED'
                        ? {
                            ...path,
                            resultBlock: (rewriteBlock ?? ((block) => block))({
                              ...path.resultBlock,
                              outcomes: (rewrite ?? ((outcomes) => outcomes))(
                                path.resultBlock.outcomes
                              )
                            })
                          }
                        : path
                    )
                  }))
                }
          )
        }
      : srd
  return discoverEncounterFeatureActions({
    actor: srdCreatureActor({ id: ACTOR_ID, creature }),
    conditionDefinitionIds,
    abilityDefinitions,
    spells: new Map()
  })
}

/** The start-of-turn heal the room runs for the holder, at `hitPoints` of `maximumHitPoints`. */
async function regenerate(
  found: ReturnType<typeof discoverRegeneration>,
  hitPoints: number,
  targetDamageTypesTaken: string[] = [],
  maximumHitPoints = 100
) {
  const capability = found.passiveStartOfTurnEffects[0]?.capability
  if (!capability) throw new Error('No start-of-turn effect was discovered.')
  const plan = compileEncounterFeatureActionPlan(dnd5eCharacterRuleActionSystemAdapter, capability)
  return executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan,
    occurrenceId: testUuid(0x4a02),
    binding: {
      actionMechanic: {
        attackBonus: null,
        attackKind: null,
        attackDomain: null,
        attackAbility: null,
        attackRollMode: 'NORMAL',
        save: null,
        outcomes: capability.mechanicFacts.outcomes
      },
      sourceDerivedFacts: {},
      targetActorId: ACTOR_ID,
      targetDerivedFacts: { statBlock: { armorClass: 12 }, savingThrowDefinitions: [] },
      targetConditionIds: [],
      currentHitPoints: hitPoints,
      temporaryHitPoints: 0,
      maximumHitPoints,
      targetDamageTypesTaken,
      targetScalarValues: {},
      defenses: []
    },
    afterTest: async () => undefined
  })
}

describe('start-of-turn regeneration authored from core options (SPELLS-33.T4i1a)', () => {
  it.each(['Oni', 'Shield Guardian'])(
    '%s regains 10 hit points when it has at least 1',
    async (label) => {
      const result = await regenerate(discoverRegeneration(label), 40)
      expect(result.applications).toMatchObject([
        { kind: 'HEAL', targetActorId: ACTOR_ID, appliedAmount: 10 }
      ])
    }
  )

  it.each(['Oni', 'Shield Guardian'])('%s regains nothing at 0 hit points', async (label) => {
    const result = await regenerate(discoverRegeneration(label), 0)
    expect(result.applications).toEqual([])
  })

  it('heals a homebrew amount through the same options, naming no creature', async () => {
    const result = await regenerate(
      discoverRegeneration('Oni', (outcomes) =>
        outcomes.map((outcome) =>
          outcome.effectKind === 'HEAL' && 'amount' in outcome ? { ...outcome, amount: 7 } : outcome
        )
      ),
      40
    )
    expect(result.applications).toMatchObject([{ kind: 'HEAL', appliedAmount: 7 }])
  })

  it('refuses a start-of-turn trait that does anything but heal', () => {
    const found = discoverRegeneration('Oni', (outcomes) =>
      outcomes.map((outcome) => ({ ...outcome, effectKind: 'KILL' }) as Outcome)
    )
    expect(found.passiveStartOfTurnEffects).toEqual([])
    expect(found.unavailable.filter(({ label }) => label === 'Regeneration')).toMatchObject([
      {
        label: 'Regeneration',
        reason: 'A start-of-turn trigger heals its holder and does nothing else.'
      }
    ])
  })
})

describe('damage-type suppression authored from core options (SPELLS-33.T4i1b2)', () => {
  it.each([
    ['Vampire', 20],
    ['Vampire Spawn', 10]
  ])(
    '%s regains %i hit points while it has at least 1 and took no radiant damage',
    async (label, amount) => {
      const found = discoverRegeneration(label)
      expect((await regenerate(found, 40, [damageTypeId('FIRE')])).applications).toMatchObject([
        { kind: 'HEAL', targetActorId: ACTOR_ID, appliedAmount: amount }
      ])
      expect((await regenerate(found, 0)).applications).toEqual([])
    }
  )

  it.each(['Vampire', 'Vampire Spawn'])(
    '%s regains nothing after radiant damage',
    async (label) => {
      const result = await regenerate(discoverRegeneration(label), 40, [damageTypeId('RADIANT')])
      expect(result.applications).toEqual([])
    }
  )

  it('Troll regains 10 hit points even at 0, unless it took acid or fire damage', async () => {
    const found = discoverRegeneration('Troll')
    expect((await regenerate(found, 0)).applications).toMatchObject([
      { kind: 'HEAL', appliedAmount: 10 }
    ])
    for (const code of ['ACID', 'FIRE'])
      expect((await regenerate(found, 0, [damageTypeId(code)])).applications).toEqual([])
    expect((await regenerate(found, 0, [damageTypeId('COLD')])).applications).toMatchObject([
      { kind: 'HEAL' }
    ])
  })

  it('suppresses a homebrew trait by the damage types its author chose, naming no creature', async () => {
    const found = discoverRegeneration('Oni', undefined, (block) => ({
      ...block,
      suppressedByDamageTypeIds: [damageTypeId('COLD')]
    }))
    expect((await regenerate(found, 40, [damageTypeId('COLD')])).applications).toEqual([])
    expect((await regenerate(found, 40, [damageTypeId('FIRE')])).applications).toMatchObject([
      { kind: 'HEAL', appliedAmount: 10 }
    ])
  })
})
