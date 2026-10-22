import { describe, expect, it } from 'vitest'
import { movementPassageOfModifiers } from '../encounterMovementPassagePolicy.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import type { BasicActionReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/basicActions'
import {
  reusableDefinitionDocumentDtoSchema,
  type ReusableDefinitionCurrentDto,
  type ReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { ATTACK_DOMAIN_CODE } from '@artificer-toolkit/shared/core'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { buildCompiledActionTargetPolicy } from '../encounterActionEntryPointCompiler.js'
import { evaluateEncounterActionTargetPolicy } from '../encounterActionTargetPolicy.js'
import { requireEncounterBasicActionDefinition } from '../encounterBasicActions.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { withSourceSightSave } from '../encounterActiveGrants.js'
import { withEncounterHolderDefense } from '../encounterHolderDefense.js'
import { withEncounterConditionMechanics } from '../encounterConditionMechanics.js'
import type { MovementTarget } from '../encounterMovementTargets.js'
import { labelEncounterRollModeReasons, rollModeSourceKey } from '../encounterRollModeReasons.js'
import { dodgeEffect, sourceSightSaveEffect } from './antitoxinEffectFixture.js'
import { srdConditionDefinitionSource } from './srdConditionDefinitions.js'

const SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const HOMEBREW_SYSTEM_ID = '00000000-0000-0000-0000-0000000000aa'
const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111'
const DEXTERITY_ID = '00000000-0000-0000-0011-000200000000'
const ACTOR_ACTION_CAPABILITY_ID = '00000000-0000-4000-8000-0000000000d4'
const INCAPACITATED_ID = '00000000-0000-0000-0002-000700000000'
const RESTRAINED_ID = '00000000-0000-0000-0002-000d00000000'
const DODGE_EFFECT_ID = '00000000-0000-4000-8000-00000000d0d0'
const IDS = {
  firstAid: '00000000-0000-4000-8000-000000000b09'
}

function actor(id: string, disposition: 'FRIENDLY' | 'HOSTILE' = 'FRIENDLY') {
  return encounterRunActorStateSchema.parse({
    id,
    encounterId: ENCOUNTER_ID,
    kind: 'CREATURE',
    label: `Actor ${id.slice(-1)}`,
    sourceId: null,
    sourceRevision: null,
    public: true,
    controllerUserIds: [],
    disposition,
    initiative: null,
    manualOrder: null,
    conditions: [],
    healthDisplay: null,
    systemId: SYSTEM_ID,
    stableTieKey: id,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    defeated: false,
    form: null,
    absence: null,
    resources: {},
    gmNotes: null,
    sideId: '22222222-2222-4222-8222-222222222222',
    snapshot: { payload: {} },
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z'
  })
}

const fighter = actor('33333333-3333-4333-8333-333333333331')
const rogue = actor('33333333-3333-4333-8333-333333333332')
const ogre = actor('33333333-3333-4333-8333-333333333333', 'HOSTILE')

const WISDOM_ID = '00000000-0000-0000-0011-000500000000'
const WALK_ID = '00000000-0000-0000-000c-000100000000'

function currentDefinition(
  document: ReusableDefinitionDocumentDto,
  definitionFamilyKey: string
): ReusableDefinitionCurrentDto {
  return {
    id: document.id,
    gameSystemId: SYSTEM_ID,
    contentSourceId: '44444444-4444-4444-8444-444444444444',
    definitionFamilyKey,
    label: definitionFamilyKey,
    description: null,
    document: reusableDefinitionDocumentDtoSchema.parse(document),
    checksum: checksumRuleDocument(document),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-09-26T00:00:00.000Z',
    publishedBy: '55555555-5555-4555-8555-555555555555'
  }
}

/** The SRD actor-action capability and the Incapacitated condition that suppresses it. */
const definitions = {
  requireCurrent: async (id: string) => {
    if (id === ACTOR_ACTION_CAPABILITY_ID)
      return currentDefinition(
        { schemaVersion: 1, kind: 'RULE_CAPABILITY', id, gameSystemId: SYSTEM_ID, usage: null },
        'rule-capability'
      )
    if (id === INCAPACITATED_ID)
      return currentDefinition(
        {
          schemaVersion: 1,
          kind: 'CONDITION_RULE_STATE',
          id,
          gameSystemId: SYSTEM_ID,
          capabilitySuppressions: [
            {
              id,
              order: 0,
              kind: 'CAPABILITY_SUPPRESS',
              capabilityDefinitionIds: [ACTOR_ACTION_CAPABILITY_ID]
            }
          ],
          perceptionContributions: [],
          mechanics: []
        },
        'condition-rule-state'
      )
    return srdConditionDefinitionSource().requireCurrent(id)
  }
}

function target(
  actorState: ReturnType<typeof actor>,
  options: { conditions?: string[]; activeEffects?: MovementTarget['activeEffects'] } = {}
): MovementTarget {
  return {
    characterFacts: null,
    actor: actorState,
    activeEffects: options.activeEffects ?? [],
    state: { current: 10, temporary: 0, conditions: options.conditions ?? [], deathSaves: null },
    initialConditionRows: null,
    effectiveMaximumHitPoints: 10,
    damageInterceptions: [],
    baseScalarValues: {},
    effectiveScalarValues: {},
    baseRulePolicyOutput: null,
    perceptionSenses: [],
    effectiveRulePolicyOutput: null,
    targetDerivedFacts: {
      savingThrowDefinitions: [
        { abilityDefinitionId: DEXTERITY_ID, rollMode: 'NORMAL', contributors: [] },
        { abilityDefinitionId: WISDOM_ID, rollMode: 'NORMAL', contributors: [] }
      ]
    },
    defenses: [],
    qualifiedDefenses: [],
    conditionImmunityIds: [],
    sourceConditionImmunities: [],
    spellSchoolImmunityIds: [],
    characterCurrentness: null,
    attackAgainstContributors: [],
    sourceSightSaves: [],
    conditionDefinitions: [],
    conditionMechanics: [],
    grantedAttackTraits: [],
    movementPassage: movementPassageOfModifiers(DND5E_SYSTEM_ID, []),
    featureModifiers: [],
    innateConditionIds: []
  }
}

function document(id: string, gameSystemId = SYSTEM_ID): BasicActionReusableDefinitionDocumentDto {
  return {
    schemaVersion: 1,
    kind: 'BASIC_ACTION',
    id,
    gameSystemId,
    rulesText: 'Rules text.',
    actionCost: 'ACTION',
    restrictions: null,
    effects: []
  }
}

function published(
  label: string,
  body: BasicActionReusableDefinitionDocumentDto
): ReusableDefinitionCurrentDto {
  return {
    id: body.id,
    gameSystemId: body.gameSystemId,
    contentSourceId: '44444444-4444-4444-8444-444444444444',
    definitionFamilyKey: 'basic-action',
    label,
    description: null,
    document: body,
    checksum: checksumRuleDocument(body),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-09-26T00:00:00.000Z',
    publishedBy: '55555555-5555-4555-8555-555555555555'
  }
}

describe('basic action mechanics (Q11)', () => {
  it('Dodge gives attacks against the actor disadvantage and its Dexterity saves advantage', async () => {
    const dodge = dodgeEffect({ id: DODGE_EFFECT_ID, holderActorId: fighter.id })
    const defended = await withEncounterHolderDefense({
      target: target(fighter, { activeEffects: [dodge] }),
      gameSystemId: SYSTEM_ID,
      definitions,
      speedDefinitions: SRD_SPEEDS,
      runEffectsByActorId: new Map(),
      readTurnMovedFeet: async () => 0
    })
    const sourceId = createCharacterMechanicSourceKey({
      kind: 'ACTIVE_EFFECT',
      activeEffectId: DODGE_EFFECT_ID
    })
    const source = {
      kind: 'ACTIVE_EFFECT',
      id: DODGE_EFFECT_ID,
      holderActorId: fighter.id
    } as const
    const contributor = (influence: 'ADVANTAGE' | 'DISADVANTAGE') => ({
      sourceId,
      grantId: expect.any(String),
      domainKey: `active-grant:${fighter.id}`,
      influence,
      source
    })
    // One disadvantage per attack domain, each holding only while the dodger sees the attacker.
    expect(defended.attackAgainstContributors).toHaveLength(
      Object.values(ATTACK_DOMAIN_CODE).length
    )
    expect(
      defended.attackAgainstContributors.map(({ attackDomain }) => attackDomain).sort()
    ).toEqual(Object.values(ATTACK_DOMAIN_CODE).sort())
    for (const entry of defended.attackAgainstContributors) {
      expect(entry.requiresHolderSeesAttacker).toBe(true)
      expect(entry.contributor).toEqual(contributor('DISADVANTAGE'))
    }
    expect(defended.targetDerivedFacts.savingThrowDefinitions).toEqual([
      {
        abilityDefinitionId: DEXTERITY_ID,
        rollMode: 'ADVANTAGE',
        contributors: [contributor('ADVANTAGE')]
      },
      { abilityDefinitionId: WISDOM_ID, rollMode: 'NORMAL', contributors: [] }
    ])
    const reasons = labelEncounterRollModeReasons(new Map([[rollModeSourceKey(source), 'Dodge']]))
    expect(
      reasons({
        rollMode: 'DISADVANTAGE',
        contributors: defended.attackAgainstContributors.flatMap(({ contributor }) =>
          contributor ? [contributor] : []
        )
      })
    ).toEqual(['Dodge'])
    expect(
      await withEncounterHolderDefense({
        target: target(fighter),
        gameSystemId: SYSTEM_ID,
        definitions,
        speedDefinitions: SRD_SPEEDS,
        runEffectsByActorId: new Map(),
        readTurnMovedFeet: async () => 0
      })
    ).toEqual(target(fighter))
  })

  it('Dodge applies nothing while the actor is incapacitated or its speed is 0', async () => {
    const activeEffects = [dodgeEffect({ id: DODGE_EFFECT_ID, holderActorId: fighter.id })]
    for (const suspended of [
      target(fighter, { conditions: [INCAPACITATED_ID], activeEffects }),
      // Restrained sets a 30-foot walk to 0 through its authored condition mechanics (D94).
      await withEncounterConditionMechanics({
        target: target(
          encounterRunActorStateSchema.parse({
            ...fighter,
            snapshot: { payload: { speeds: [{ speedId: WALK_ID, amount: 30, unit: 'FEET' }] } }
          }),
          { conditions: [RESTRAINED_ID], activeEffects }
        ),
        gameSystemId: SYSTEM_ID,
        definitions
      }),
      target(
        encounterRunActorStateSchema.parse({
          ...fighter,
          snapshot: { payload: { speeds: [{ speedId: WALK_ID, amount: 0, unit: 'FEET' }] } }
        }),
        { activeEffects }
      )
    ]) {
      const defended = await withEncounterHolderDefense({
        target: suspended,
        gameSystemId: SYSTEM_ID,
        definitions,
        speedDefinitions: SRD_SPEEDS,
        runEffectsByActorId: new Map(),
        readTurnMovedFeet: async () => 0
      })
      expect(defended.attackAgainstContributors).toEqual([])
      expect(defended.targetDerivedFacts).toEqual(suspended.targetDerivedFacts)
    }
  })

  it('a sight-gated save advantage waits for preparation: the holder lists it, and the rows stay as they were', async () => {
    const effect = sourceSightSaveEffect({ id: DODGE_EFFECT_ID, holderActorId: fighter.id })
    const defended = await withEncounterHolderDefense({
      target: target(fighter, { activeEffects: [effect] }),
      gameSystemId: SYSTEM_ID,
      definitions,
      speedDefinitions: SRD_SPEEDS,
      runEffectsByActorId: new Map(),
      readTurnMovedFeet: async () => 0
    })
    expect(defended.targetDerivedFacts).toEqual(target(fighter).targetDerivedFacts)
    expect(defended.sourceSightSaves).toEqual([
      {
        abilityDefinitionId: DEXTERITY_ID,
        contributor: {
          sourceId: createCharacterMechanicSourceKey({
            kind: 'ACTIVE_EFFECT',
            activeEffectId: DODGE_EFFECT_ID
          }),
          grantId: expect.any(String),
          domainKey: expect.any(String),
          influence: 'ADVANTAGE',
          source: { kind: 'ACTIVE_EFFECT', id: DODGE_EFFECT_ID, holderActorId: fighter.id }
        }
      }
    ])
    // Preparation merges the contributors it proves into the matching row alone.
    const merged = withSourceSightSave(
      SYSTEM_ID,
      defended.targetDerivedFacts,
      DEXTERITY_ID,
      defended.sourceSightSaves.map(({ contributor }) => contributor)
    )
    expect(merged.savingThrowDefinitions).toMatchObject([
      { abilityDefinitionId: DEXTERITY_ID, rollMode: 'ADVANTAGE' },
      { abilityDefinitionId: WISDOM_ID, rollMode: 'NORMAL', contributors: [] }
    ])
    expect(withSourceSightSave(SYSTEM_ID, defended.targetDerivedFacts, DEXTERITY_ID, [])).toBe(
      defended.targetDerivedFacts
    )
  })

  it('a sight-gated save advantage lists nothing while its holder is incapacitated', async () => {
    const defended = await withEncounterHolderDefense({
      target: target(fighter, {
        conditions: [INCAPACITATED_ID],
        activeEffects: [sourceSightSaveEffect({ id: DODGE_EFFECT_ID, holderActorId: fighter.id })]
      }),
      gameSystemId: SYSTEM_ID,
      definitions,
      speedDefinitions: SRD_SPEEDS,
      runEffectsByActorId: new Map(),
      readTurnMovedFeet: async () => 0
    })
    expect(defended.sourceSightSaves).toEqual([])
  })

  it('Help targets one other creature at any distance and warns, softly, when it is hostile', () => {
    const help = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.HELP)!
    const targetPolicy = buildCompiledActionTargetPolicy(
      characterActionDescriptor(
        compileEffect({ ...help.document.effects[0]!, id: ACTION_EFFECT_ID })
      )
    )
    const warnings = (target: typeof rogue) =>
      evaluateEncounterActionTargetPolicy({
        actor: fighter,
        target,
        targetPolicy,
        sceneContext: null,
        makesAttackRoll: false
      })
    expect(targetPolicy.range.rangeKind).toBe('UNLIMITED')
    expect(warnings(rogue)).toEqual([])
    expect(warnings(ogre)).toEqual([
      { code: 'TARGET_DISPOSITION', message: 'This action needs a willing target.' }
    ])
    // Aiming it at its own user is a refusal, not an overridable warning.
    expect(warnings(fighter)).toBeNull()
  })

  it('First Aid needs exactly one other creature', () => {
    const firstAid = SRD_BASIC_ACTION_DEFINITIONS.find(
      ({ id }) => id === SRD_BASIC_ACTION_IDS.FIRST_AID
    )!
    const targetPolicy = buildCompiledActionTargetPolicy(
      characterActionDescriptor(
        compileEffect({ ...firstAid.document.effects[0]!, id: ACTION_EFFECT_ID })
      )
    )
    const warnings = (target: typeof rogue) =>
      evaluateEncounterActionTargetPolicy({
        actor: fighter,
        target,
        targetPolicy,
        sceneContext: null,
        makesAttackRoll: false
      })
    // Touch range cannot be checked without a Scene (D11); it only warns.
    expect(warnings(rogue)).toEqual([
      {
        code: 'TARGET_RANGE_UNCHECKED',
        message: "Range can't be checked without both tokens on the map."
      }
    ])
    // Aiming it at its own user is a refusal, not an overridable warning.
    expect(warnings(fighter)).toBeNull()
    expect(warnings(rogue)).not.toContainEqual(
      expect.objectContaining({ code: 'TARGET_DISPOSITION' })
    )
    // It needs a willing creature: a hostile one only warns, and the table can override it.
    expect(warnings(ogre)).toContainEqual({
      code: 'TARGET_DISPOSITION',
      message: 'This action needs a willing target.'
    })
  })
})

describe('basic action catalogue identity', () => {
  it("accepts only a published basic-action entry of the Run's System", () => {
    const help = published('First Aid', document(IDS.firstAid))
    expect(
      requireEncounterBasicActionDefinition({ gameSystemId: SYSTEM_ID }, help).document
    ).toEqual(help.document)
    expect(() => requireEncounterBasicActionDefinition({ gameSystemId: SYSTEM_ID }, null)).toThrow()
    expect(() =>
      requireEncounterBasicActionDefinition(
        { gameSystemId: SYSTEM_ID },
        { ...help, definitionFamilyKey: 'sense' }
      )
    ).toThrow()
  })

  it('a homebrew System overrides an entry with its own name, text and cost', () => {
    const sprint = published('Rally', {
      ...document(IDS.firstAid, HOMEBREW_SYSTEM_ID),
      rulesText: 'Patch up an ally, as a bonus action.',
      actionCost: 'BONUS_ACTION'
    })
    const resolved = requireEncounterBasicActionDefinition(
      { gameSystemId: HOMEBREW_SYSTEM_ID },
      sprint
    )
    expect(resolved.definition.label).toBe('Rally')
    expect(resolved.document).toMatchObject({ actionCost: 'BONUS_ACTION' })
    // An SRD Encounter never uses the homebrew System's entry.
    expect(() =>
      requireEncounterBasicActionDefinition({ gameSystemId: SYSTEM_ID }, sprint)
    ).toThrow()
  })
})
