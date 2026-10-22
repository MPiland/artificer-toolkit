import {
  SRD_BLINDSIGHT_SENSE_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { ROLL_MODE_RULE_SOURCE_IDS } from '@artificer-toolkit/shared/rules/contributors'
import { describe, expect, it } from 'vitest'

import {
  encounterAttackD20Belief,
  encounterAttackSightCaptions,
  encounterSaveSightCaptions,
  isEncounterSightGovernedD20,
  reconcileEncounterD20Faces
} from '../encounterAttackBelief.js'
import {
  encounterAttackSightContributors,
  resolveEncounterAttackPerception,
  resolveEncounterBelievedAttackPerception,
  type EncounterAttackPerception,
  type EncounterPerceptionRoller
} from '../encounterAttackPerception.js'
import { selectEncounterActionD20Natural } from '../encounterEvidenceAnswer.js'
import { mergeCanonicalD20Contributors } from '../encounterRelationshipActionFacts.js'
import { encounterRuleContributorSource } from '../encounterRollModeReasons.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  srdAttackPerceptionLoaders,
  srdConditionId
} from './encounterCreatureAction.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { resolveDnd5eRollMode } from '../systems/dnd5e/rollModePolicy.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

const ATTACKER_ID = testUuid(0xb1)
const TARGET_ID = testUuid(0xb2)
const INVISIBLE = srdConditionId('INVISIBLE')
const BLINDED = srdConditionId('BLINDED')

const dodge = {
  sourceId: 'test:dodge',
  grantId: null,
  domainKey: 'test:dodge',
  influence: 'DISADVANTAGE' as const,
  source: { kind: 'AUTHORED' as const, id: 'test:dodge', holderActorId: null }
}

const blindsightLabel = srdSystemRecord.senses.find(
  (sense) => sense.id === SRD_BLINDSIGHT_SENSE_ID
)!.label

/** Real true and believed perception between a senseless attacker and a possibly Blindsighted target. */
async function perceptions(input: {
  attackerConditionIds?: readonly string[]
  targetConditionIds?: readonly string[]
  targetBlindsight?: boolean
  roller?: EncounterPerceptionRoller
}) {
  const prepared = await prepareCreatureAction({
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
    overridable: true
  })
  const loaders = srdAttackPerceptionLoaders()
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
      target,
      roller: input.roller
    })
  }
}

/** The true d20 policy fields for the true sight contributors plus other contributors. */
function truePolicy(
  trueSight: ReturnType<typeof encounterAttackSightContributors>,
  others: ReturnType<typeof encounterAttackSightContributors> = []
) {
  const contributors = [...mergeCanonicalD20Contributors(trueSight, others)]
  const { rollMode, keep } = resolveDnd5eRollMode(contributors)
  return {
    rollMode,
    keep,
    contributors,
    contributorChecksum: checksumRuleDocument(contributors)
  }
}

describe('encounter attack d20 belief', () => {
  it('shows advantage for an Invisible attacker a Blindsighted target still senses (true Normal)', async () => {
    const { actual, believed } = await perceptions({
      attackerConditionIds: [INVISIBLE],
      targetBlindsight: true
    })
    expect(believed.targetSeesAttacker).toBe('UNSEEN')
    expect(actual.targetSeesAttacker).toBe('SEES')
    expect(actual.targetSenseLabels).toContain(blindsightLabel)
    const trueSight = encounterAttackSightContributors({
      perception: actual,
      attacksAgainst: []
    })
    const policy = truePolicy(trueSight)
    expect(policy.rollMode).toBe('NORMAL')
    const belief = encounterAttackD20Belief({
      gameSystemId: DND5E_SYSTEM_ID,
      policy,
      trueSight,
      believedSight: encounterAttackSightContributors({
        perception: believed,
        attacksAgainst: []
      })
    })
    expect(belief).toMatchObject({ rollMode: 'ADVANTAGE' })
    expect(belief!.contributorChecksum).toBe(checksumRuleDocument(belief!.contributors))
    expect(isEncounterSightGovernedD20({ policy, belief })).toBe(true)
  })

  it('drops Dodge from the belief while the true mode keeps it against a sensing target', async () => {
    const { actual, believed } = await perceptions({
      attackerConditionIds: [INVISIBLE],
      targetBlindsight: true
    })
    const trueSight = encounterAttackSightContributors({
      perception: actual,
      attacksAgainst: [
        {
          requiresHolderSeesAttacker: true,
          exemptAttackerSenseDefinitionIds: [],
          contributor: dodge
        }
      ]
    })
    const policy = truePolicy(trueSight)
    expect(policy.rollMode).toBe('DISADVANTAGE')
    const belief = encounterAttackD20Belief({
      gameSystemId: DND5E_SYSTEM_ID,
      policy,
      trueSight,
      believedSight: encounterAttackSightContributors({
        perception: believed,
        attacksAgainst: [
          {
            requiresHolderSeesAttacker: true,
            exemptAttackerSenseDefinitionIds: [],
            contributor: dodge
          }
        ]
      })
    })
    expect(belief?.rollMode).toBe('ADVANTAGE')
    expect(belief?.contributors.map((contributor) => contributor.sourceId)).not.toContain(
      dodge.sourceId
    )
  })

  it('keeps contributors the roller cannot see through sight (e.g. long range) in the belief', async () => {
    const { actual, believed } = await perceptions({
      attackerConditionIds: [INVISIBLE],
      targetBlindsight: true
    })
    const longRange = {
      ...dodge,
      sourceId: 'rule:long-range',
      domainKey: 'rule:long-range',
      source: encounterRuleContributorSource(ROLL_MODE_RULE_SOURCE_IDS.LONG_RANGE)
    }
    const trueSight = encounterAttackSightContributors({
      perception: actual,
      attacksAgainst: []
    })
    const belief = encounterAttackD20Belief({
      gameSystemId: DND5E_SYSTEM_ID,
      policy: truePolicy(trueSight, [longRange]),
      trueSight,
      believedSight: encounterAttackSightContributors({
        perception: believed,
        attacksAgainst: []
      })
    })
    expect(belief?.contributors.map((contributor) => contributor.sourceId)).toContain(
      'rule:long-range'
    )
    expect(belief?.rollMode).toBe('NORMAL')
  })

  it('has no belief when nothing sight-hidden differs, and is then not sight-governed', async () => {
    const { actual, believed } = await perceptions({})
    const trueSight = encounterAttackSightContributors({
      perception: actual,
      attacksAgainst: [
        {
          requiresHolderSeesAttacker: true,
          exemptAttackerSenseDefinitionIds: [],
          contributor: dodge
        }
      ]
    })
    const policy = truePolicy(trueSight)
    const belief = encounterAttackD20Belief({
      gameSystemId: DND5E_SYSTEM_ID,
      policy,
      trueSight,
      believedSight: encounterAttackSightContributors({
        perception: believed,
        attacksAgainst: [
          {
            requiresHolderSeesAttacker: true,
            exemptAttackerSenseDefinitionIds: [],
            contributor: dodge
          }
        ]
      })
    })
    expect(belief).toBeNull()
    expect(isEncounterSightGovernedD20({ policy, belief })).toBe(false)
  })

  it('is sight-governed by an unseen contributor even when the belief agrees', async () => {
    const { actual, believed } = await perceptions({ attackerConditionIds: [BLINDED] })
    const trueSight = encounterAttackSightContributors({
      perception: actual,
      attacksAgainst: []
    })
    const policy = truePolicy(trueSight)
    expect(policy.rollMode).toBe('DISADVANTAGE')
    const belief = encounterAttackD20Belief({
      gameSystemId: DND5E_SYSTEM_ID,
      policy,
      trueSight,
      believedSight: encounterAttackSightContributors({
        perception: believed,
        attacksAgainst: []
      })
    })
    expect(belief).toBeNull()
    expect(isEncounterSightGovernedD20({ policy, belief })).toBe(true)
  })
})

describe('encounter attack sight captions', () => {
  const perception = (value: Partial<EncounterAttackPerception>): EncounterAttackPerception => ({
    targetSeesAttacker: 'SEES',
    attackerSeesTarget: 'SEES',
    targetSenseLabels: [],
    attackerSenseLabels: [],
    attackerSenseDefinitionIds: [],
    ...value
  })
  const names = { attackerLabel: 'Quill Beast', targetLabel: 'Wolf' }

  it('says nothing when sight agrees', () => {
    expect(
      encounterAttackSightCaptions({ believed: perception({}), actual: perception({}), ...names })
    ).toBeNull()
  })

  it('cancels advantage generically for the player and names the Sense for the GM', async () => {
    const { actual, believed } = await perceptions({
      attackerConditionIds: [INVISIBLE],
      targetBlindsight: true
    })
    const captions = encounterAttackSightCaptions({ believed, actual, ...names })
    expect(captions).toEqual({
      playerCaption: 'Advantage cancelled: the target can sense you',
      gmReason: `Wolf senses Quill Beast with ${blindsightLabel}`
    })
    for (const sense of srdSystemRecord.senses)
      expect(captions!.playerCaption.toLowerCase()).not.toContain(sense.label.toLowerCase())
  })

  it('words every other direction as the design note says', () => {
    const captionsFor = (
      believed: Partial<EncounterAttackPerception>,
      actual: Partial<EncounterAttackPerception>
    ) =>
      encounterAttackSightCaptions({
        believed: perception(believed),
        actual: perception(actual),
        ...names
      })
    expect(captionsFor({}, { targetSeesAttacker: 'UNSEEN' })).toEqual({
      playerCaption: "Advantage: the target can't see you",
      gmReason: "Wolf can't see Quill Beast"
    })
    expect(captionsFor({}, { attackerSeesTarget: 'UNSEEN' })).toEqual({
      playerCaption: "Disadvantage: you can't see the target",
      gmReason: "Quill Beast can't see Wolf"
    })
    expect(
      captionsFor(
        { attackerSeesTarget: 'UNSEEN' },
        { attackerSeesTarget: 'SEES', attackerSenseLabels: ['Blindsight', 'Darkvision'] }
      )
    ).toEqual({
      playerCaption: 'Disadvantage cancelled: you can sense the target',
      gmReason: 'Quill Beast senses Wolf with Blindsight, Darkvision'
    })
  })

  it('joins several reasons with a middle dot within 160 characters', () => {
    const captions = encounterAttackSightCaptions({
      believed: perception({ targetSeesAttacker: 'UNSEEN', attackerSeesTarget: 'UNSEEN' }),
      actual: perception({
        targetSenseLabels: ['Blindsight'],
        attackerSenseLabels: ['Darkvision']
      }),
      attackerLabel: 'A'.repeat(50),
      targetLabel: 'B'.repeat(50)
    })
    expect(captions!.playerCaption).toBe(
      'Advantage cancelled: the target can sense you · Disadvantage cancelled: you can sense the target'
    )
    expect(captions!.gmReason).toContain(' · ')
    expect(captions!.gmReason.length).toBeLessThanOrEqual(160)
  })
})

describe('believed sight for a save', () => {
  it('believes the saver is Blinded when it rolls the save, but not when it rolls an attack', async () => {
    const save = await perceptions({ targetConditionIds: [BLINDED], roller: 'TARGET' })
    expect(save.believed.targetSeesAttacker).toBe('UNSEEN')
    const attack = await perceptions({ targetConditionIds: [BLINDED] })
    expect(attack.believed.targetSeesAttacker).toBe('SEES')
  })

  it('believes the source is Invisible to the saver, as it is', async () => {
    const { believed } = await perceptions({ attackerConditionIds: [INVISIBLE], roller: 'TARGET' })
    expect(believed.targetSeesAttacker).toBe('UNSEEN')
  })
})

describe('encounter save sight captions', () => {
  const advantage = {
    sourceId: 'test:danger-sense',
    grantId: null,
    domainKey: 'test:danger-sense',
    influence: 'ADVANTAGE' as const,
    source: { kind: 'AUTHORED' as const, id: 'test:danger-sense', holderActorId: null }
  }
  const disadvantage = { ...advantage, influence: 'DISADVANTAGE' as const }
  const sight = (
    value: Partial<Parameters<typeof encounterSaveSightCaptions>[0]>
  ): Parameters<typeof encounterSaveSightCaptions>[0] => ({
    gameSystemId: DND5E_SYSTEM_ID,
    actual: {
      targetSeesAttacker: 'SEES',
      attackerSeesTarget: 'SEES',
      targetSenseLabels: [],
      attackerSenseLabels: [],
      attackerSenseDefinitionIds: []
    },
    trueSight: [],
    believedSight: [],
    attackerLabel: 'Fireball Caster',
    targetLabel: 'Barbarian',
    ...value
  })

  it('says nothing when the saver believes the mode it gets', () => {
    expect(
      encounterSaveSightCaptions(sight({ trueSight: [advantage], believedSight: [advantage] }))
    ).toBeNull()
  })

  it('shows the player a generic reason and the GM the specific one when advantage is lost', () => {
    const captions = encounterSaveSightCaptions(sight({ believedSight: [advantage] }))
    expect(captions).toEqual({
      playerCaption: 'Advantage no longer applies to this save',
      gmReason: "Barbarian can't see Fireball Caster"
    })
    expect(captions!.playerCaption).not.toContain('Fireball Caster')
  })

  it('names the Sense only for the GM when advantage is gained, and words disadvantage alike', () => {
    const gained = encounterSaveSightCaptions(
      sight({
        trueSight: [advantage],
        actual: {
          targetSeesAttacker: 'SEES',
          attackerSeesTarget: 'SEES',
          targetSenseLabels: [blindsightLabel],
          attackerSenseLabels: [],
          attackerSenseDefinitionIds: []
        }
      })
    )
    expect(gained).toEqual({
      playerCaption: 'Advantage applies to this save',
      gmReason: `Barbarian senses Fireball Caster with ${blindsightLabel}`
    })
    expect(gained!.playerCaption).not.toContain(blindsightLabel)
    expect(encounterSaveSightCaptions(sight({ trueSight: [disadvantage] }))!.playerCaption).toBe(
      'Disadvantage applies to this save'
    )
  })
})

describe('reconcile rolled d20 faces to the applied mode', () => {
  it('keeps the faces and reports no adjustment when the mode is unchanged', () => {
    expect(
      reconcileEncounterD20Faces({
        appliedMode: 'ADVANTAGE',
        rolledMode: 'ADVANTAGE',
        rolledFaces: [4, 16],
        extraFace: null
      })
    ).toEqual({ kind: 'SETTLED', faces: [4, 16], natural: 16, adjustment: null })
    expect(
      reconcileEncounterD20Faces({
        appliedMode: 'NORMAL',
        rolledMode: 'NORMAL',
        rolledFaces: [9],
        extraFace: () => {
          throw new Error('No extra die is needed.')
        }
      })
    ).toEqual({ kind: 'SETTLED', faces: [9], natural: 9, adjustment: null })
  })

  it('keeps the first die and cancels the second when two were rolled for a Normal roll', () => {
    expect(
      reconcileEncounterD20Faces({
        appliedMode: 'NORMAL',
        rolledMode: 'ADVANTAGE',
        rolledFaces: [4, 16],
        extraFace: null
      })
    ).toEqual({
      kind: 'SETTLED',
      faces: [4],
      natural: 4,
      adjustment: {
        rolledMode: 'ADVANTAGE',
        rolledFaces: [4, 16],
        addedFaces: [],
        cancelledRollIndexes: [1],
        addedRollIndexes: []
      }
    })
  })

  it('keeps the lower of two dice when advantage turns into disadvantage', () => {
    expect(
      reconcileEncounterD20Faces({
        appliedMode: 'DISADVANTAGE',
        rolledMode: 'ADVANTAGE',
        rolledFaces: [4, 16],
        extraFace: null
      })
    ).toEqual({
      kind: 'SETTLED',
      faces: [4, 16],
      natural: 4,
      adjustment: {
        rolledMode: 'ADVANTAGE',
        rolledFaces: [4, 16],
        addedFaces: [],
        cancelledRollIndexes: [],
        addedRollIndexes: []
      }
    })
  })

  it('rolls one more die through extraFace when one die meets advantage or disadvantage', () => {
    const settled = reconcileEncounterD20Faces({
      appliedMode: 'ADVANTAGE',
      rolledMode: 'NORMAL',
      rolledFaces: [7],
      extraFace: () => 18
    })
    expect(settled).toEqual({
      kind: 'SETTLED',
      faces: [7, 18],
      natural: selectEncounterActionD20Natural('ADVANTAGE', [7, 18]),
      adjustment: {
        rolledMode: 'NORMAL',
        rolledFaces: [7],
        addedFaces: [18],
        cancelledRollIndexes: [],
        addedRollIndexes: [1]
      }
    })
    expect(
      reconcileEncounterD20Faces({
        appliedMode: 'DISADVANTAGE',
        rolledMode: 'NORMAL',
        rolledFaces: [7],
        extraFace: () => 18
      })
    ).toMatchObject({ kind: 'SETTLED', faces: [7, 18], natural: 7 })
  })

  it('needs one more d20 when none can be rolled for the roller', () => {
    expect(
      reconcileEncounterD20Faces({
        appliedMode: 'DISADVANTAGE',
        rolledMode: 'NORMAL',
        rolledFaces: [7],
        extraFace: null
      })
    ).toEqual({ kind: 'NEEDS_EXTRA_D20' })
  })

  it('refuses faces that do not match the mode they were rolled with', () => {
    expect(() =>
      reconcileEncounterD20Faces({
        appliedMode: 'NORMAL',
        rolledMode: 'ADVANTAGE',
        rolledFaces: [7],
        extraFace: null
      })
    ).toThrow()
  })
})
