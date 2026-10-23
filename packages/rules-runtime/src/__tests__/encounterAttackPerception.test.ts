import { ROLL_MODE_RULE_SOURCE_IDS } from '@artificer-toolkit/shared/rules/contributors'
import {
  SRD_BLINDSIGHT_SENSE_ID,
  SRD_DARKVISION_SENSE_ID,
  SRD_DEVILS_SIGHT_SENSE_ID,
  SRD_TRUESIGHT_SENSE_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { describe, expect, it } from 'vitest'

import {
  encounterAttackPerceptionContributors,
  encounterAttackSightContributors,
  resolveEncounterAttackPerception,
  resolveEncounterBelievedAttackPerception,
  resolveEncounterPointSight,
  type EncounterAttackPerception
} from '../encounterAttackPerception.js'
import {
  ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
  ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
  encounterRuleContributorSource,
  labelEncounterRollModeReasons
} from '../encounterRollModeReasons.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction,
  srdConditionId
} from './encounterCreatureAction.js'
import { currentConditionDefinition } from './srdConditionDefinitions.js'
import { concealmentRecord } from '../testing/concealmentFixture.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const ATTACKER_ID = testUuid(0xa1)
const TARGET_ID = testUuid(0xa2)
const BYSTANDER_ID = testUuid(0xa3)
const INVISIBLE = srdConditionId('INVISIBLE')
const BLINDED = srdConditionId('BLINDED')
const DODGE_SOURCE_ID = 'test:dodge'

const dodge = {
  sourceId: DODGE_SOURCE_ID,
  grantId: null,
  domainKey: DODGE_SOURCE_ID,
  influence: 'DISADVANTAGE' as const,
  source: { kind: 'AUTHORED' as const, id: DODGE_SOURCE_ID, holderActorId: null }
}

const dodgeAgainst = {
  attackDomain: 'RANGED' as const,
  requiresHolderSeesAttacker: true,
  exemptAttackerSenseDefinitionIds: [],
  eventScope: { actorId: null, turnActorId: null },
  sourceQualifier: [],
  contributor: dodge,
  suppressedInfluence: null
}

/** A +5 ranged Quill Volley from a senseless Wolf-based Creature at another one. */
function volleyAt(input: {
  attackerConditionIds?: readonly string[]
  targetConditionIds?: readonly string[]
  targetDodges?: boolean
}) {
  return prepareCreatureAction({
    actor: creatureActor({
      id: ATTACKER_ID,
      label: 'Quill Beast',
      features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })],
      conditionIds: input.attackerConditionIds ?? []
    }),
    target: creatureActor({
      id: TARGET_ID,
      label: 'Wolf',
      features: [],
      conditionIds: input.targetConditionIds ?? []
    }),
    featureId: QUILL_VOLLEY_ID,
    overridable: true,
    attackPerception: true,
    ...(input.targetDodges ? { targetAttacksAgainst: [dodgeAgainst] } : {})
  })
}

const sourceIds = (prepared: Awaited<ReturnType<typeof volleyAt>>) =>
  prepared.relationshipContributors.map((contributor) => contributor.sourceId)

describe('encounter attack perception: contributors', () => {
  const sight = (value: Partial<EncounterAttackPerception>): EncounterAttackPerception => ({
    targetSeesAttacker: 'SEES',
    attackerSeesTarget: 'SEES',
    targetSenseLabels: [],
    attackerSenseLabels: [],
    attackerSenseDefinitionIds: [],
    ...value
  })

  it('gives advantage for an attacker its target cannot see and disadvantage against a target it cannot see', () => {
    expect(encounterAttackPerceptionContributors(sight({ targetSeesAttacker: 'UNSEEN' }))).toEqual([
      {
        sourceId: ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
        grantId: null,
        domainKey: ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
        influence: 'ADVANTAGE',
        source: encounterRuleContributorSource(ROLL_MODE_RULE_SOURCE_IDS.UNSEEN_ATTACKER)
      }
    ])
    expect(encounterAttackPerceptionContributors(sight({ attackerSeesTarget: 'UNSEEN' }))).toEqual([
      {
        sourceId: ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
        grantId: null,
        domainKey: ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
        influence: 'DISADVANTAGE',
        source: encounterRuleContributorSource(ROLL_MODE_RULE_SOURCE_IDS.UNSEEN_TARGET)
      }
    ])
  })

  it('adds nothing when both sides see', () => {
    expect(encounterAttackPerceptionContributors(sight({}))).toEqual([])
  })

  it('drops a contributor that exempts a Sense the attacker sees the target through (Blur)', () => {
    const exempting = (attackerSenseDefinitionIds: string[]) =>
      encounterAttackSightContributors({
        perception: sight({ attackerSenseDefinitionIds }),
        attacksAgainst: [
          {
            requiresHolderSeesAttacker: false,
            exemptAttackerSenseDefinitionIds: [SRD_BLINDSIGHT_SENSE_ID, SRD_TRUESIGHT_SENSE_ID],
            contributor: dodge,
            suppressedInfluence: null
          }
        ]
      }).map((contributor) => contributor.sourceId)
    expect(exempting([])).toEqual([DODGE_SOURCE_ID])
    expect(exempting(['00000000-0000-4000-8000-0000000000aa'])).toEqual([DODGE_SOURCE_ID])
    expect(exempting([SRD_TRUESIGHT_SENSE_ID])).toEqual([])
    expect(exempting(['00000000-0000-4000-8000-0000000000aa', SRD_BLINDSIGHT_SENSE_ID])).toEqual([])
  })

  it('keeps Dodge only while the target can see the attacker, beside the sight contributors', () => {
    const merged = (value: Partial<EncounterAttackPerception>) =>
      encounterAttackSightContributors({
        perception: sight(value),
        attacksAgainst: [
          {
            requiresHolderSeesAttacker: true,
            exemptAttackerSenseDefinitionIds: [],
            contributor: dodge,
            suppressedInfluence: null
          }
        ]
      }).map((contributor) => contributor.sourceId)
    expect(merged({})).toEqual([DODGE_SOURCE_ID])
    expect(merged({ targetSeesAttacker: 'UNSEEN' })).toEqual([
      ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID
    ])
    expect(merged({ attackerSeesTarget: 'UNSEEN' })).toEqual(
      [DODGE_SOURCE_ID, ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID].sort()
    )
  })

  it('labels both contributors for the roll reasons', () => {
    const reasons = labelEncounterRollModeReasons(new Map())
    const [advantage] = encounterAttackPerceptionContributors(
      sight({ targetSeesAttacker: 'UNSEEN' })
    )
    const [disadvantage] = encounterAttackPerceptionContributors(
      sight({ attackerSeesTarget: 'UNSEEN' })
    )
    expect(reasons({ rollMode: 'ADVANTAGE', contributors: [advantage!] })).toEqual([
      'Unseen attacker'
    ])
    expect(reasons({ rollMode: 'DISADVANTAGE', contributors: [disadvantage!] })).toEqual([
      'Unseen target'
    ])
  })
})

describe('encounter attack perception: attack rolls (SRD unseen attacker and target)', () => {
  it('rolls with advantage against a target that cannot see an Invisible attacker', async () => {
    const prepared = await volleyAt({ attackerConditionIds: [INVISIBLE] })
    expect(prepared.relationshipContributors).toContainEqual({
      sourceId: ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
      grantId: null,
      domainKey: ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
      influence: 'ADVANTAGE',
      source: encounterRuleContributorSource(ROLL_MODE_RULE_SOURCE_IDS.UNSEEN_ATTACKER)
    })
    const { execution } = await settleCreatureAction({ prepared, rolls: [5, 9] })
    expect(execution.d20).toMatchObject({ derivedRollMode: 'ADVANTAGE', selectedNatural: 10 })
  })

  it('rolls with disadvantage when the attacker is Blinded and cannot see its target', async () => {
    const prepared = await volleyAt({ attackerConditionIds: [BLINDED] })
    expect(sourceIds(prepared)).toContain(ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID)
    expect(sourceIds(prepared)).not.toContain(ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID)
  })

  it('rolls with disadvantage against an Invisible target the attacker cannot see', async () => {
    const prepared = await volleyAt({ targetConditionIds: [INVISIBLE] })
    expect(sourceIds(prepared)).toContain(ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID)
    const { execution } = await settleCreatureAction({ prepared, rolls: [15, 2] })
    expect(execution.d20).toMatchObject({ derivedRollMode: 'DISADVANTAGE', selectedNatural: 3 })
  })

  it('adds no sight contributor when both sides see', async () => {
    const prepared = await volleyAt({})
    expect(sourceIds(prepared)).not.toContain(ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID)
    expect(sourceIds(prepared)).not.toContain(ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID)
  })

  it('adds no sight contributor to a flow that does not load perception', async () => {
    const prepared = await prepareCreatureAction({
      actor: creatureActor({
        id: ATTACKER_ID,
        label: 'Quill Beast',
        features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })],
        conditionIds: [INVISIBLE]
      }),
      target: creatureActor({ id: TARGET_ID, label: 'Wolf', features: [] }),
      featureId: QUILL_VOLLEY_ID,
      overridable: true
    })
    expect(sourceIds(prepared)).not.toContain(ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID)
  })

  it('drops the Dodge disadvantage against an attacker the dodger cannot see', async () => {
    const unseen = await volleyAt({ attackerConditionIds: [INVISIBLE], targetDodges: true })
    expect(sourceIds(unseen)).not.toContain(DODGE_SOURCE_ID)
    const seen = await volleyAt({ targetDodges: true })
    expect(sourceIds(seen)).toContain(DODGE_SOURCE_ID)
  })

  const dodgingSrdTargetAgainstInvisible = (label: string) =>
    prepareCreatureAction({
      actor: creatureActor({
        id: ATTACKER_ID,
        label: 'Quill Beast',
        features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })],
        conditionIds: [INVISIBLE]
      }),
      target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, label) }),
      featureId: QUILL_VOLLEY_ID,
      overridable: true,
      attackPerception: true,
      targetAttacksAgainst: [dodgeAgainst]
    })

  it("decides a Creature's sight by its authored Senses: Darkvision does not reveal an Invisible attacker", async () => {
    const prepared = await dodgingSrdTargetAgainstInvisible('Ogre')
    expect(sourceIds(prepared)).toContain(ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID)
    expect(sourceIds(prepared)).not.toContain(DODGE_SOURCE_ID)
  })

  it('lets a Creature with Truesight see an Invisible attacker, so Dodge stays', async () => {
    const prepared = await dodgingSrdTargetAgainstInvisible('Couatl')
    expect(sourceIds(prepared)).toContain(DODGE_SOURCE_ID)
    expect(sourceIds(prepared)).not.toContain(ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID)
  })
})

/**
 * SPELLS-31.T4k2a: a target's grant that negates advantage (Elusive) leaves an attack at it no
 * advantage, and a grant made on an occasion (Escape the Horde's opportunity attacks) holds only for
 * an attack made on that occasion.
 */
describe('encounter attacks against: negated advantage and attack occasion', () => {
  const negateAgainst = {
    ...dodgeAgainst,
    requiresHolderSeesAttacker: false,
    contributor: null,
    suppressedInfluence: 'ADVANTAGE'
  }
  const opportunityAgainst = {
    ...dodgeAgainst,
    requiresHolderSeesAttacker: false,
    attackOccasion: 'OPPORTUNITY' as const
  }

  it('drops the advantage of an unseen attacker and keeps the disadvantage of an unseen target', () => {
    const contributors = (value: Partial<EncounterAttackPerception>) =>
      encounterAttackSightContributors({
        perception: {
          targetSeesAttacker: 'SEES',
          attackerSeesTarget: 'SEES',
          targetSenseLabels: [],
          attackerSenseLabels: [],
          attackerSenseDefinitionIds: [],
          ...value
        },
        attacksAgainst: [negateAgainst]
      }).map((contributor) => contributor.sourceId)
    expect(contributors({ targetSeesAttacker: 'UNSEEN' })).toEqual([])
    expect(contributors({ attackerSeesTarget: 'UNSEEN' })).toEqual([
      ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID
    ])
  })

  it('rolls an Invisible attacker’s attack normally against a target that negates advantage', async () => {
    const prepared = await prepareCreatureAction({
      actor: creatureActor({
        id: ATTACKER_ID,
        label: 'Quill Beast',
        features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })],
        conditionIds: [INVISIBLE]
      }),
      target: creatureActor({ id: TARGET_ID, label: 'Wolf', features: [] }),
      featureId: QUILL_VOLLEY_ID,
      overridable: true,
      attackPerception: true,
      targetAttacksAgainst: [negateAgainst]
    })
    expect(sourceIds(prepared)).not.toContain(ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID)
    const { execution } = await settleCreatureAction({ prepared, rolls: [5] })
    expect(execution.d20).toMatchObject({ derivedRollMode: 'NORMAL', selectedNatural: 6 })
  })

  it('drops the advantage a Restrained target gives when the target negates advantage', async () => {
    const restrainedTarget = (targetAttacksAgainst: readonly (typeof negateAgainst)[]) =>
      prepareCreatureAction({
        actor: creatureActor({
          id: ATTACKER_ID,
          label: 'Quill Beast',
          features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })]
        }),
        target: creatureActor({
          id: TARGET_ID,
          label: 'Wolf',
          features: [],
          conditionIds: [srdConditionId('RESTRAINED')]
        }),
        featureId: QUILL_VOLLEY_ID,
        overridable: true,
        targetAttacksAgainst
      })
    const restrained = await settleCreatureAction({
      prepared: await restrainedTarget([]),
      rolls: [5, 9]
    })
    expect(restrained.execution.d20).toMatchObject({ derivedRollMode: 'ADVANTAGE' })
    const negated = await settleCreatureAction({
      prepared: await restrainedTarget([negateAgainst]),
      rolls: [5]
    })
    expect(negated.execution.d20).toMatchObject({ derivedRollMode: 'NORMAL', selectedNatural: 6 })
  })

  it('applies an opportunity-only grant to an opportunity attack alone', async () => {
    const volley = (attackOccasion?: 'OPPORTUNITY') =>
      prepareCreatureAction({
        actor: creatureActor({
          id: ATTACKER_ID,
          label: 'Quill Beast',
          features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })]
        }),
        target: creatureActor({ id: TARGET_ID, label: 'Wolf', features: [] }),
        featureId: QUILL_VOLLEY_ID,
        overridable: true,
        targetAttacksAgainst: [opportunityAgainst],
        ...(attackOccasion ? { attackOccasion } : {})
      })
    expect(sourceIds(await volley())).not.toContain(DODGE_SOURCE_ID)
    expect(sourceIds(await volley('OPPORTUNITY'))).toContain(DODGE_SOURCE_ID)
  })
})

describe('encounter attack perception: resolver', () => {
  async function resolve(input: { targetSenses: boolean }) {
    const prepared = await volleyAt({ attackerConditionIds: [INVISIBLE] })
    const truesight = SRD_SENSE_DEFINITIONS.find((sense) => sense.id === SRD_TRUESIGHT_SENSE_ID)!
    return resolveEncounterAttackPerception({
      gameSystemId: prepared.state.gameSystemId,
      attacker: prepared.sourceFacts,
      target: {
        ...prepared.targetFacts,
        perceptionSenses: input.targetSenses
          ? [
              {
                senseDefinitionId: SRD_TRUESIGHT_SENSE_ID,
                range: { id: 'sense-range', rangeKind: 'UNLIMITED' as const }
              }
            ]
          : []
      },
      placement: null,
      loadDefinition: async (id) => {
        if (id !== SRD_TRUESIGHT_SENSE_ID) throw new Error(`Unexpected definition ${id}.`)
        return {
          definitionFamilyKey: 'sense',
          gameSystemId: prepared.state.gameSystemId,
          current: currentConditionDefinition({
            id: truesight.id,
            definitionFamilyKey: 'sense',
            label: truesight.label,
            document: truesight.document
          })
        }
      },
      loadSystem: async () => srdSystemRecord
    })
  }

  it('lets an observer whose Senses perceive invisible creatures see an Invisible attacker', async () => {
    expect(await resolve({ targetSenses: true })).toEqual({
      targetSeesAttacker: 'SEES',
      attackerSeesTarget: 'SEES',
      targetSenseLabels: [senseLabel(SRD_TRUESIGHT_SENSE_ID)],
      attackerSenseLabels: [],
      attackerSenseDefinitionIds: []
    })
  })

  it('does not let an observer without such a Sense see the Invisible attacker', async () => {
    expect(await resolve({ targetSenses: false })).toEqual({
      targetSeesAttacker: 'UNSEEN',
      attackerSeesTarget: 'SEES',
      targetSenseLabels: [],
      attackerSenseLabels: [],
      attackerSenseDefinitionIds: []
    })
  })
})

const senseLabel = (id: string) => srdSystemRecord.senses.find((sense) => sense.id === id)!.label

/** Loads the SRD Sense definitions a pinned Sense names. */
const srdSenseLoaders = (gameSystemId: string) => ({
  gameSystemId,
  loadDefinition: async (id: string) => {
    const sense = SRD_SENSE_DEFINITIONS.find((value) => value.id === id)
    if (!sense) throw new Error(`Unexpected definition ${id}.`)
    return {
      definitionFamilyKey: 'sense',
      gameSystemId,
      current: currentConditionDefinition({
        id: sense.id,
        definitionFamilyKey: 'sense',
        label: sense.label,
        document: sense.document
      })
    }
  },
  loadSystem: async () => srdSystemRecord
})

/** Real perception between a senseless attacker and a target that may have Blindsight. */
async function blindsightPerceptions(input: {
  attackerConditionIds?: readonly string[]
  targetConditionIds?: readonly string[]
  targetBlindsight: boolean
}) {
  const prepared = await volleyAt({
    attackerConditionIds: input.attackerConditionIds ?? [INVISIBLE],
    ...(input.targetConditionIds ? { targetConditionIds: input.targetConditionIds } : {})
  })
  const loaders = srdSenseLoaders(prepared.state.gameSystemId)
  const target = {
    ...prepared.targetFacts,
    perceptionSenses: input.targetBlindsight
      ? [
          {
            senseDefinitionId: SRD_BLINDSIGHT_SENSE_ID,
            range: { id: 'sense-range', rangeKind: 'UNLIMITED' as const }
          }
        ]
      : []
  }
  return {
    actual: await resolveEncounterAttackPerception({
      ...loaders,
      attacker: prepared.sourceFacts,
      target,
      placement: null
    }),
    believed: await resolveEncounterBelievedAttackPerception({
      ...loaders,
      attacker: prepared.sourceFacts,
      target
    })
  }
}

describe('encounter attack perception: the Senses the attacker sees through (Blur)', () => {
  it('names an Invisible target seen by Truesight, in true and believed perception alike', async () => {
    const prepared = await volleyAt({ attackerConditionIds: [], targetConditionIds: [INVISIBLE] })
    const loaders = srdSenseLoaders(prepared.state.gameSystemId)
    const attacker = {
      ...prepared.sourceFacts,
      perceptionSenses: [
        {
          senseDefinitionId: SRD_TRUESIGHT_SENSE_ID,
          range: { id: 'sense-range', rangeKind: 'UNLIMITED' as const }
        }
      ]
    }
    const target = prepared.targetFacts
    const actual = await resolveEncounterAttackPerception({
      ...loaders,
      attacker,
      target,
      placement: null
    })
    const believed = await resolveEncounterBelievedAttackPerception({
      ...loaders,
      attacker,
      target
    })
    expect(actual).toMatchObject({
      attackerSeesTarget: 'SEES',
      attackerSenseDefinitionIds: [SRD_TRUESIGHT_SENSE_ID]
    })
    expect(believed.attackerSenseDefinitionIds).toEqual([SRD_TRUESIGHT_SENSE_ID])
  })

  it('names no Sense for an attacker that cannot see the target', async () => {
    const prepared = await volleyAt({ attackerConditionIds: [], targetConditionIds: [INVISIBLE] })
    const actual = await resolveEncounterAttackPerception({
      ...srdSenseLoaders(prepared.state.gameSystemId),
      attacker: prepared.sourceFacts,
      target: prepared.targetFacts,
      placement: null
    })
    expect(actual).toMatchObject({ attackerSeesTarget: 'UNSEEN', attackerSenseDefinitionIds: [] })
  })
})

describe('encounter attack perception: believed perception (ATTACK-10.1)', () => {
  it('does not credit the target with the Senses the roller may not know of', async () => {
    const { actual, believed } = await blindsightPerceptions({ targetBlindsight: true })
    expect(actual).toMatchObject({ targetSeesAttacker: 'SEES' })
    expect(actual.targetSenseLabels).toEqual([senseLabel(SRD_BLINDSIGHT_SENSE_ID)])
    expect(believed).toEqual({
      targetSeesAttacker: 'UNSEEN',
      attackerSeesTarget: 'SEES',
      targetSenseLabels: [],
      attackerSenseLabels: [],
      attackerSenseDefinitionIds: []
    })
  })

  it('believes an Invisible target is seen, and a Blinded attacker cannot see', async () => {
    const invisibleTarget = await blindsightPerceptions({
      attackerConditionIds: [],
      targetConditionIds: [INVISIBLE],
      targetBlindsight: false
    })
    expect(invisibleTarget.actual.attackerSeesTarget).toBe('UNSEEN')
    expect(invisibleTarget.believed.attackerSeesTarget).toBe('SEES')
    const blindedAttacker = await blindsightPerceptions({
      attackerConditionIds: [BLINDED],
      targetBlindsight: false
    })
    expect(blindedAttacker.believed.attackerSeesTarget).toBe('UNSEEN')
  })
})

describe('encounter attack perception: a concealed attacker (ATTACK-10.T1)', () => {
  /** The true and believed sight of an attacker whose concealment fooled `fooledIds` (never empty: no observers plans no effect). */
  async function concealedAttackerPerceptions(input: {
    fooledIds: readonly string[]
    targetDisposition: 'FRIENDLY' | 'HOSTILE'
  }) {
    const prepared = await prepareCreatureAction({
      actor: creatureActor({
        id: ATTACKER_ID,
        label: 'Quill Beast',
        features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })]
      }),
      target: creatureActor({
        id: TARGET_ID,
        label: 'Wolf',
        features: [],
        disposition: input.targetDisposition
      }),
      featureId: QUILL_VOLLEY_ID,
      overridable: true
    })
    const attacker = {
      ...prepared.sourceFacts,
      activeEffects: [
        concealmentRecord({
          encounterId: prepared.state.id,
          holderActorId: ATTACKER_ID,
          observerActorIds: input.fooledIds,
          concealmentTotal: 15
        })
      ]
    }
    const loaders = srdSenseLoaders(prepared.state.gameSystemId)
    return {
      actual: await resolveEncounterAttackPerception({
        ...loaders,
        attacker,
        target: prepared.targetFacts,
        placement: null
      }),
      believed: await resolveEncounterBelievedAttackPerception({
        ...loaders,
        attacker,
        target: prepared.targetFacts
      })
    }
  }

  it('is unseen by the observers it fooled and seen by the ones that noticed it', async () => {
    const fooled = await concealedAttackerPerceptions({
      fooledIds: [TARGET_ID],
      targetDisposition: 'FRIENDLY'
    })
    const noticed = await concealedAttackerPerceptions({
      fooledIds: [BYSTANDER_ID],
      targetDisposition: 'FRIENDLY'
    })
    expect(fooled.actual.targetSeesAttacker).toBe('UNSEEN')
    expect(noticed.actual.targetSeesAttacker).toBe('SEES')
  })

  it('is believed hidden from every non-allied target, so the prompt never names who failed', async () => {
    const fooled = await concealedAttackerPerceptions({
      fooledIds: [TARGET_ID],
      targetDisposition: 'FRIENDLY'
    })
    const noticed = await concealedAttackerPerceptions({
      fooledIds: [BYSTANDER_ID],
      targetDisposition: 'FRIENDLY'
    })
    expect(fooled.believed).toEqual(noticed.believed)
    expect(fooled.believed.targetSeesAttacker).toBe('UNSEEN')
  })

  it('is believed seen by an ally, which a concealment never hides it from', async () => {
    const ally = await concealedAttackerPerceptions({
      fooledIds: [TARGET_ID],
      targetDisposition: 'HOSTILE'
    })
    expect(ally.believed.targetSeesAttacker).toBe('SEES')
  })
})

describe('encounter attack perception: Creature Senses on a dark Scene (VTT_UI-5.2)', () => {
  const GRID = {
    kind: 'SQUARE',
    cellSize: 100,
    diagonalPolicy: 'EQUAL',
    distancePerCell: 5,
    origin: { x: 0, y: 0 },
    unit: 'FEET'
  } as const
  const tokenAt = (id: number, label: string, x: number) => ({
    id: testUuid(id),
    assetId: null,
    controlledByUserIds: [],
    height: 100,
    width: 100,
    hidden: false,
    locked: false,
    label,
    rotationDegrees: 0,
    position: { x, y: 50 },
    senses: [],
    vision: null
  })

  const ogre = srdByLabel(SRD.creatures, 'Ogre')

  /**
   * The actual and the believed perception between a senseless Quill Beast attacker and an SRD
   * Creature target `feet` apart on a dark Scene.
   */
  async function darkScenePerception(input: {
    feet: number
    target: typeof ogre
    attackerConditionIds?: readonly string[]
  }) {
    const prepared = await prepareCreatureAction({
      actor: creatureActor({
        id: ATTACKER_ID,
        label: 'Quill Beast',
        features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })],
        conditionIds: input.attackerConditionIds ?? []
      }),
      target: srdCreatureActor({ id: TARGET_ID, creature: input.target }),
      featureId: QUILL_VOLLEY_ID,
      overridable: true
    })
    return perceptionOnDarkScene(prepared, input.feet)
  }

  async function perceptionOnDarkScene(
    prepared: Awaited<ReturnType<typeof prepareCreatureAction>>,
    feet: number
  ) {
    const loaders = srdSenseLoaders(prepared.state.gameSystemId)
    const targetToken = tokenAt(0xc1, 'Target', 50)
    const attackerToken = tokenAt(0xc2, 'Attacker', 50 + (feet / 5) * 100)
    return {
      actual: await resolveEncounterAttackPerception({
        ...loaders,
        attacker: prepared.sourceFacts,
        target: prepared.targetFacts,
        placement: {
          scene: {
            ambientIllumination: 'ORDINARY_DARKNESS',
            barriers: [],
            darknessZones: [],
            doorStates: {},
            grid: GRID,
            lights: [],
            tokens: [targetToken, attackerToken]
          },
          sceneGrid: GRID,
          attackerToken,
          targetToken,
          spatialEffects: []
        }
      }),
      believed: await resolveEncounterBelievedAttackPerception({
        ...loaders,
        attacker: prepared.sourceFacts,
        target: prepared.targetFacts
      })
    }
  }

  it("sees within a Creature's authored Darkvision range and not beyond it", async () => {
    expect((await darkScenePerception({ feet: 50, target: ogre })).actual.targetSeesAttacker).toBe(
      'SEES'
    )
    expect((await darkScenePerception({ feet: 70, target: ogre })).actual.targetSeesAttacker).toBe(
      'UNSEEN'
    )
  })

  it("sees a target through an attacking Creature's authored Darkvision, and not beyond it", async () => {
    const attackFromOgre = async (feet: number) =>
      (
        await perceptionOnDarkScene(
          await prepareCreatureAction({
            actor: srdCreatureActor({ id: ATTACKER_ID, creature: ogre }),
            target: creatureActor({ id: TARGET_ID, label: 'Quill Beast', features: [] }),
            featureId: creatureFeature(ogre, 'Greatclub').id,
            overridable: true
          }),
          feet
        )
      ).actual.attackerSeesTarget
    expect(await attackFromOgre(50)).toBe('SEES')
    expect(await attackFromOgre(70)).toBe('UNSEEN')
  })

  it('does not believe in a Creature range the roller cannot know of', async () => {
    // The roller assumes the Ogre sees on the neutral environment; the dark Scene says it does not.
    const beyondDarkvision = await darkScenePerception({ feet: 70, target: ogre })
    expect(beyondDarkvision.believed.targetSeesAttacker).toBe('SEES')
    expect(beyondDarkvision.actual.targetSeesAttacker).toBe('UNSEEN')

    // The roller does not credit the Creature's own Senses, so it believes an Invisible attacker
    // is unseen by a Creature whose Blindsight actually finds it.
    const blindsighted = SRD.creatures.find((creature) =>
      creature.senses.some(
        (sense) =>
          sense.senseDefinitionId === SRD_BLINDSIGHT_SENSE_ID &&
          sense.range.rangeKind === 'DISTANCE' &&
          sense.range.amount >= 30 &&
          !sense.qualifier
      )
    )
    if (!blindsighted) throw new Error('Missing an SRD Creature with plain Blindsight.')
    const invisibleAttacker = await darkScenePerception({
      feet: 30,
      target: blindsighted,
      attackerConditionIds: [INVISIBLE]
    })
    expect(invisibleAttacker.actual.targetSeesAttacker).toBe('SEES')
    expect(invisibleAttacker.believed.targetSeesAttacker).toBe('UNSEEN')
  })
})

describe('encounter attack perception: sight of a point', () => {
  const GRID = {
    kind: 'SQUARE',
    cellSize: 100,
    diagonalPolicy: 'EQUAL',
    distancePerCell: 5,
    origin: { x: 0, y: 0 },
    unit: 'FEET'
  } as const
  const observerToken = {
    id: testUuid(0xb1),
    assetId: null,
    controlledByUserIds: [],
    height: 100,
    width: 100,
    hidden: false,
    locked: false,
    label: 'Quill Beast',
    rotationDegrees: 0,
    position: { x: 50, y: 50 },
    senses: [],
    vision: null
  }
  const POINT = { x: 850, y: 50 }
  const wall = (blocksLight: boolean) => ({
    kind: 'WALL' as const,
    id: testUuid(0xb2),
    a: { x: 450, y: -500 },
    b: { x: 450, y: 500 },
    blocksLight,
    blocksMovement: false
  })

  /** Magical darkness over the whole Scene, as a Darkness spell's zone records it. */
  const magicalDarkness = {
    id: testUuid(0xb3),
    mechanicalIllumination: 'MAGICAL_DARKNESS' as const,
    mechanicalObscurement: null,
    opacity: 0.5,
    polygon: {
      points: [
        { x: -1000, y: -1000 },
        { x: 2000, y: -1000 },
        { x: 2000, y: 1000 },
        { x: -1000, y: 1000 }
      ]
    }
  }

  async function sightOf(input: {
    conditionIds?: readonly string[]
    /** Senses the observer has, each at `feet`. */
    senses?: { ids: readonly string[]; feet: number }
    scene?: Partial<{
      ambientIllumination: 'BRIGHT' | 'DIM' | 'ORDINARY_DARKNESS'
      barriers: ReturnType<typeof wall>[]
      darknessZones: (typeof magicalDarkness)[]
    }> | null
  }) {
    const prepared = await volleyAt({ attackerConditionIds: input.conditionIds ?? [] })
    const senses = input.senses
    return resolveEncounterPointSight({
      gameSystemId: prepared.state.gameSystemId,
      observer: senses
        ? {
            ...prepared.sourceFacts,
            perceptionSenses: senses.ids.map((senseDefinitionId) => ({
              senseDefinitionId,
              range: {
                id: `${senseDefinitionId}:range`,
                rangeKind: 'DISTANCE' as const,
                amount: senses.feet,
                unit: 'FEET' as const
              }
            }))
          }
        : prepared.sourceFacts,
      point: POINT,
      placement: input.scene
        ? {
            scene: {
              ambientIllumination: 'BRIGHT',
              barriers: [],
              darknessZones: [],
              doorStates: {},
              grid: GRID,
              lights: [],
              tokens: [observerToken],
              ...input.scene
            },
            sceneGrid: GRID,
            observerToken,
            spatialEffects: []
          }
        : null,
      ...(senses
        ? srdSenseLoaders(prepared.state.gameSystemId)
        : { loadDefinition: async () => null, loadSystem: async () => srdSystemRecord })
    })
  }

  it('sees a point in the open on a lit Scene, and any point without a Scene', async () => {
    expect(await sightOf({ scene: {} })).toBe('SEES')
    expect(await sightOf({ scene: null })).toBe('SEES')
  })

  it('does not see a point behind a barrier that blocks light, but sees past one that does not', async () => {
    expect(await sightOf({ scene: { barriers: [wall(true)] } })).toBe('UNSEEN')
    expect(await sightOf({ scene: { barriers: [wall(false)] } })).toBe('SEES')
  })

  it('does not see a point in darkness with no Sense that sees in it', async () => {
    expect(await sightOf({ scene: { ambientIllumination: 'ORDINARY_DARKNESS' } })).toBe('UNSEEN')
  })

  it('does not see anything while Blinded, with or without a Scene', async () => {
    expect(await sightOf({ scene: {}, conditionIds: [BLINDED] })).toBe('UNSEEN')
    expect(await sightOf({ scene: null, conditionIds: [BLINDED] })).toBe('UNSEEN')
  })

  // SPELLS-31.T3b (D156): Devil's Sight is its own Sense, not darkvision (VTT_UI-3.5).
  it("sees a point in magical darkness through Devil's Sight, which darkvision does not", async () => {
    const dark = { darknessZones: [magicalDarkness] }
    const devilsSight = { ids: [SRD_DEVILS_SIGHT_SENSE_ID], feet: 120 }
    expect(await sightOf({ scene: dark, senses: devilsSight })).toBe('SEES')
    expect(
      await sightOf({ scene: dark, senses: { ids: [SRD_DARKVISION_SENSE_ID], feet: 120 } })
    ).toBe('UNSEEN')
    expect(
      await sightOf({ scene: { ambientIllumination: 'ORDINARY_DARKNESS' }, senses: devilsSight })
    ).toBe('SEES')
  })

  it("does not see past Devil's Sight's range, nor while Blinded", async () => {
    const dark = { darknessZones: [magicalDarkness] }
    expect(
      await sightOf({ scene: dark, senses: { ids: [SRD_DEVILS_SIGHT_SENSE_ID], feet: 20 } })
    ).toBe('UNSEEN')
    expect(
      await sightOf({
        scene: dark,
        senses: { ids: [SRD_DEVILS_SIGHT_SENSE_ID], feet: 120 },
        conditionIds: [BLINDED]
      })
    ).toBe('UNSEEN')
  })
})
