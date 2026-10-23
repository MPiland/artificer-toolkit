import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { ROLL_MODE_RULE_SOURCE_IDS } from '@artificer-toolkit/shared/rules/contributors'

import { rollRuleCheckDtoSchema } from '../api/rolls.js'
import { encounterActionPendingContextDtoSchema } from '../shared/encounterActionPending.js'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '../shared/encounterRuleOccurrence.js'
import {
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema
} from '../shared/ruleExecutionEvidence.js'

const uuid = (suffix: number) => `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, '0')}`

const advantage = {
  sourceId: 'rule:unseen-attacker',
  grantId: null,
  domainKey: 'rule:unseen-attacker',
  influence: 'ADVANTAGE' as const,
  source: {
    kind: 'RULE' as const,
    id: ROLL_MODE_RULE_SOURCE_IDS.UNSEEN_ATTACKER,
    holderActorId: null
  }
}

const evidenceBase = (contributors: (typeof advantage)[]) => ({
  requestId: 'attack-request',
  derivedRollMode: 'NORMAL' as const,
  contributors,
  contributorChecksum: checksumRuleDocument(contributors),
  modifier: 4,
  defenseOrDc: 15,
  resultPath: 'ON_HIT'
})

describe('d20 evidence mode adjustment', () => {
  const adjustment = {
    rolledMode: 'ADVANTAGE' as const,
    rolledKeep: 'HIGHER' as const,
    rolledFaces: [3, 17],
    addedFaces: [] as number[],
    cancelledRollIndexes: [1],
    addedRollIndexes: [] as number[],
    playerCaption: 'Advantage cancelled: the target can sense you',
    gmReason: 'Wolf senses Quill Beast with Blindsight'
  }
  const cancelled = {
    ...evidenceBase([]),
    rollMode: 'NORMAL' as const,
    keep: 'FIRST' as const,
    rawFaces: [3],
    selectedNatural: 3,
    total: 7,
    modeAdjustment: adjustment
  }

  it('accepts a cancelled die, an added die and a mode change without a die change', () => {
    expect(serverRuleExecutionD20EvidenceDtoSchema.safeParse(cancelled).success).toBe(true)
    expect(
      serverRuleExecutionD20EvidenceDtoSchema.safeParse({
        ...cancelled,
        rollMode: 'ADVANTAGE',
        keep: 'HIGHER',
        rawFaces: [8, 14],
        selectedNatural: 14,
        total: 18,
        modeAdjustment: {
          ...adjustment,
          rolledMode: 'NORMAL',
          rolledKeep: 'FIRST',
          rolledFaces: [8],
          addedFaces: [14],
          cancelledRollIndexes: [],
          addedRollIndexes: [1]
        }
      }).success
    ).toBe(true)
    expect(
      serverRuleExecutionD20EvidenceDtoSchema.safeParse({
        ...cancelled,
        rollMode: 'DISADVANTAGE',
        keep: 'LOWER',
        rawFaces: [3, 17],
        selectedNatural: 3,
        total: 7,
        modeAdjustment: { ...adjustment, cancelledRollIndexes: [] }
      }).success
    ).toBe(true)
  })

  it('rejects an adjustment that disagrees with the applied faces', () => {
    for (const invalid of [
      { ...cancelled, rawFaces: [17], selectedNatural: 17, total: 21 },
      { ...cancelled, modeAdjustment: { ...adjustment, cancelledRollIndexes: [2] } },
      { ...cancelled, modeAdjustment: { ...adjustment, rolledFaces: [3] } },
      { ...cancelled, modeAdjustment: { ...adjustment, addedRollIndexes: [1] } },
      {
        ...cancelled,
        modeAdjustment: {
          ...adjustment,
          rolledMode: 'NORMAL',
          rolledFaces: [3],
          cancelledRollIndexes: []
        }
      },
      { ...cancelled, modeAdjustment: { ...adjustment, playerCaption: 'x'.repeat(161) } }
    ])
      expect(serverRuleExecutionD20EvidenceDtoSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('d20 evidence saving-throw ability (SPELLS-4.T2c2b)', () => {
  const save = {
    ...evidenceBase([]),
    rollMode: 'NORMAL' as const,
    keep: 'FIRST' as const,
    rawFaces: [9],
    selectedNatural: 9,
    total: 13,
    resultPath: 'ON_SAVE_FAIL',
    savingThrowAbilityDefinitionId: uuid(0x7a1)
  }

  it('keeps the ability a saving throw was rolled with', () => {
    for (const resultPath of ['ON_SAVE_SUCCESS', 'ON_SAVE_FAIL'])
      expect(
        serverRuleExecutionD20EvidenceDtoSchema.safeParse({ ...save, resultPath }).success
      ).toBe(true)
  })

  it('accepts saving-throw evidence that names no ability', () => {
    const { savingThrowAbilityDefinitionId: _ability, ...abilityLess } = save
    expect(serverRuleExecutionD20EvidenceDtoSchema.safeParse(abilityLess).success).toBe(true)
  })

  it('rejects an ability on evidence that is not a saving throw', () => {
    expect(
      serverRuleExecutionD20EvidenceDtoSchema.safeParse({ ...save, resultPath: 'ON_HIT' }).success
    ).toBe(false)
  })
})

describe('roll rule check D20_MODE_ADJUSTED', () => {
  const check = {
    kind: 'D20_MODE_ADJUSTED' as const,
    rolledMode: { code: 'ADVANTAGE', label: 'Advantage' },
    appliedMode: { code: 'NORMAL', label: 'Normal' },
    cancelledRollIndexes: [1],
    addedRollIndexes: [],
    caption: 'Advantage cancelled: the target can sense you'
  }

  it('carries the modes, the cancelled and added dice and a bounded caption', () => {
    expect(rollRuleCheckDtoSchema.safeParse(check).success).toBe(true)
    expect(rollRuleCheckDtoSchema.safeParse({ ...check, caption: null }).success).toBe(true)
    expect(rollRuleCheckDtoSchema.safeParse({ ...check, caption: 'x'.repeat(161) }).success).toBe(
      false
    )
    expect(
      rollRuleCheckDtoSchema.safeParse({ ...check, appliedMode: { code: 'SOMETIMES', label: '' } })
        .success
    ).toBe(false)
  })
})

describe('pending d20 request with a held d20', () => {
  const pending = {
    kind: 'D20_EVIDENCE' as const,
    occurrenceId: uuid(1),
    occurrenceVersion: 1,
    encounterVersion: 1,
    rollerActorId: uuid(2),
    request: {
      requestId: 'attack-request',
      min: 1 as const,
      max: 20 as const,
      rollMode: 'NORMAL' as const,
      keep: 'FIRST' as const,
      rollModes: [
        { code: 'NORMAL', label: 'Normal', keep: 'FIRST' },
        { code: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' }
      ],
      derivedRollModeReasons: []
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL'] as const
  }

  it('asks for one more d20 beside the held face, only on a Normal request', () => {
    const heldD20 = { faces: [12] as [number], caption: 'Advantage: the target can not see you' }
    expect(
      pendingEncounterRuleOccurrenceSummaryDtoSchema.safeParse({
        ...pending,
        request: { ...pending.request, heldD20 }
      }).success
    ).toBe(true)
    expect(pendingEncounterRuleOccurrenceSummaryDtoSchema.safeParse(pending).success).toBe(true)
    for (const invalid of [
      { ...pending.request, rollMode: 'ADVANTAGE', keep: 'HIGHER', heldD20 },
      { ...pending.request, heldD20: { ...heldD20, faces: [21] } },
      { ...pending.request, heldD20: { ...heldD20, faces: [4, 5] } },
      { ...pending.request, heldD20: { ...heldD20, caption: 'x'.repeat(161) } }
    ])
      expect(
        pendingEncounterRuleOccurrenceSummaryDtoSchema.safeParse({ ...pending, request: invalid })
          .success
      ).toBe(false)
  })
})

describe('encounter action pending context: belief and held d20', () => {
  const contributors = [advantage]
  const policy = {
    requestNodeId: 'attack',
    rollMode: 'NORMAL' as const,
    keep: 'FIRST' as const,
    contributors: [],
    contributorChecksum: checksumRuleDocument([]),
    modifier: 4,
    dc: 15
  }
  const belief = {
    rollMode: 'ADVANTAGE' as const,
    keep: 'HIGHER' as const,
    contributors,
    contributorChecksum: checksumRuleDocument(contributors)
  }
  const heldD20 = {
    rolledMode: 'NORMAL' as const,
    faces: [12] as [number],
    playerCaption: 'Advantage: the target can not see you',
    gmReason: 'Wolf can not see Quill Beast'
  }
  const context = {
    kind: 'ENCOUNTER_ACTION' as const,
    schemaVersion: 1 as const,
    commandJson: '{}',
    commandFingerprint: 'a'.repeat(64),
    initiatorUserId: uuid(3),
    rollerActorId: uuid(2),
    currentnessChecksum: 'b'.repeat(64),
    d20Policy: policy,
    twoPhase: null
  }

  it('accepts a belief and a held d20 beside the true policy', () => {
    expect(serverRuleExecutionD20PolicyDtoSchema.safeParse(policy).success).toBe(true)
    expect(encounterActionPendingContextDtoSchema.safeParse(context).success).toBe(true)
    expect(
      encounterActionPendingContextDtoSchema.safeParse({ ...context, d20Belief: belief, heldD20 })
        .success
    ).toBe(true)
  })

  it('parses any code-shaped belief mode and refuses a malformed one; the System decides meaning', () => {
    expect(
      encounterActionPendingContextDtoSchema.safeParse({
        ...context,
        d20Belief: { ...belief, rollMode: 'NORMAL' }
      }).success
    ).toBe(true)
    expect(
      encounterActionPendingContextDtoSchema.safeParse({
        ...context,
        d20Belief: { ...belief, rollMode: 'normal' }
      }).success
    ).toBe(false)
  })

  it('rejects a belief with a wrong checksum and a held d20 without a policy', () => {
    for (const invalid of [
      { ...context, d20Belief: { ...belief, contributorChecksum: 'c'.repeat(64) } },
      { ...context, d20Policy: null, heldD20 },
      { ...context, heldD20: { ...heldD20, faces: [12, 3] } }
    ])
      expect(encounterActionPendingContextDtoSchema.safeParse(invalid).success).toBe(false)
  })
})
