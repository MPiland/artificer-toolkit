import {
  SRD_TRUESIGHT_SENSE_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { describe, expect, it } from 'vitest'

import {
  encounterAttackPerceptionContributors,
  resolveEncounterAttackPerception,
  type EncounterAttackPerception
} from '../encounterAttackPerception.js'
import {
  ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
  ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
  labelEncounterRollModeReasons
} from '../encounterRollModeReasons.js'
import { SRD, srdByLabel } from './dnd5eSrdCharacter.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction,
  srdConditionId
} from './encounterCreatureAction.js'
import { currentConditionDefinition } from './srdConditionDefinitions.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const ATTACKER_ID = testUuid(0xa1)
const TARGET_ID = testUuid(0xa2)
const INVISIBLE = srdConditionId('INVISIBLE')
const BLINDED = srdConditionId('BLINDED')
const DODGE_SOURCE_ID = 'test:dodge'

const dodge = {
  sourceId: DODGE_SOURCE_ID,
  grantId: null,
  domainKey: DODGE_SOURCE_ID,
  influence: 'DISADVANTAGE' as const
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
    ...(input.targetDodges ? { targetAttackContributors: [dodge] } : {})
  })
}

const sourceIds = (prepared: Awaited<ReturnType<typeof volleyAt>>) =>
  prepared.relationshipContributors.map((contributor) => contributor.sourceId)

describe('encounter attack perception: contributors', () => {
  const sight = (value: Partial<EncounterAttackPerception>): EncounterAttackPerception => ({
    targetSeesAttacker: 'SEES',
    attackerSeesTarget: 'SEES',
    ...value
  })

  it('gives advantage for an attacker its target cannot see and disadvantage against a target it cannot see', () => {
    expect(encounterAttackPerceptionContributors(sight({ targetSeesAttacker: 'UNSEEN' }))).toEqual([
      {
        sourceId: ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
        grantId: null,
        domainKey: ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
        influence: 'ADVANTAGE'
      }
    ])
    expect(encounterAttackPerceptionContributors(sight({ attackerSeesTarget: 'UNSEEN' }))).toEqual([
      {
        sourceId: ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
        grantId: null,
        domainKey: ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID,
        influence: 'DISADVANTAGE'
      }
    ])
  })

  it('adds nothing when sight is present or undecided', () => {
    expect(encounterAttackPerceptionContributors(sight({}))).toEqual([])
    expect(
      encounterAttackPerceptionContributors({
        targetSeesAttacker: 'UNKNOWN',
        attackerSeesTarget: 'UNKNOWN'
      })
    ).toEqual([])
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
      influence: 'ADVANTAGE'
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

  it('keeps Dodge and adds no advantage when a Creature with authored Senses may still see', async () => {
    const ogre = srdByLabel(SRD.creatures, 'Ogre')
    const prepared = await prepareCreatureAction({
      actor: creatureActor({
        id: ATTACKER_ID,
        label: 'Quill Beast',
        features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })],
        conditionIds: [INVISIBLE]
      }),
      target: srdCreatureActor({ id: TARGET_ID, creature: ogre }),
      featureId: QUILL_VOLLEY_ID,
      overridable: true,
      attackPerception: true,
      targetAttackContributors: [dodge]
    })
    expect(sourceIds(prepared)).toContain(DODGE_SOURCE_ID)
    expect(sourceIds(prepared)).not.toContain(ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID)
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
        baseRulePolicyOutput: input.targetSenses
          ? { senses: [{ senseDefinitionId: SRD_TRUESIGHT_SENSE_ID, range: null }] }
          : null
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
      attackerSeesTarget: 'SEES'
    })
  })

  it('does not let an observer without such a Sense see the Invisible attacker', async () => {
    expect(await resolve({ targetSenses: false })).toEqual({
      targetSeesAttacker: 'UNSEEN',
      attackerSeesTarget: 'SEES'
    })
  })
})
