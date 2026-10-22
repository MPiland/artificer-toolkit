import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  encounterAttackRetargetOfferDtoSchema,
  encounterAttackRetargetUseOptionId,
  type EncounterFailedIncomingGateDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import { describe, expect, it } from 'vitest'

import {
  chosenEncounterAttackRetarget,
  encounterAttackRetargetOffer,
  retargetEncounterAction
} from '../encounterAttackRetarget.js'

const HOLDER = '00000000-0000-4000-8000-000000000001'
const FIRST = '00000000-0000-4000-8000-000000000002'
const SECOND = '00000000-0000-4000-8000-000000000003'
const FIRST_TOKEN = '00000000-0000-4000-8000-0000000000a2'
const SECOND_TOKEN = '00000000-0000-4000-8000-0000000000a3'

const gate = {
  effectId: '00000000-0000-4000-8000-0000000000e1',
  holderActorId: HOLDER,
  checkDefinitionId: '00000000-0000-4000-8000-0000000000c1',
  dc: 14,
  d20: {
    requestId: 'request',
    rollMode: 'NORMAL',
    keep: 'FIRST',
    derivedRollMode: 'NORMAL',
    rawFaces: [3],
    selectedNatural: 3,
    modifier: 1,
    total: 4,
    dc: 14,
    contributors: [],
    contributorChecksum: 'a'.repeat(64)
  }
} satisfies EncounterFailedIncomingGateDto

const offer = encounterAttackRetargetOffer(gate, [
  { actorId: FIRST, tokenId: FIRST_TOKEN },
  { actorId: SECOND, tokenId: SECOND_TOKEN }
])

describe('encounterAttackRetargetOffer', () => {
  it('names one issued option per candidate, derived from the ward and the creature', () => {
    expect(offer.options.map((option) => option.useOptionId)).toEqual([
      encounterAttackRetargetUseOptionId({ gateEffectId: gate.effectId, targetActorId: FIRST }),
      encounterAttackRetargetUseOptionId({ gateEffectId: gate.effectId, targetActorId: SECOND })
    ])
  })

  it('derives a different option for another ward or another creature', () => {
    const ids = new Set([
      encounterAttackRetargetUseOptionId({ gateEffectId: gate.effectId, targetActorId: FIRST }),
      encounterAttackRetargetUseOptionId({ gateEffectId: gate.effectId, targetActorId: SECOND }),
      encounterAttackRetargetUseOptionId({ gateEffectId: FIRST, targetActorId: FIRST })
    ])
    expect(ids.size).toBe(3)
  })

  it('is refused by the contract when an option id was not derived, or the holder is offered', () => {
    expect(encounterAttackRetargetOfferDtoSchema.safeParse(offer).success).toBe(true)
    const [first, second] = offer.options
    expect(
      encounterAttackRetargetOfferDtoSchema.safeParse({
        ...offer,
        options: [{ ...first!, useOptionId: second!.useOptionId }, second]
      }).success
    ).toBe(false)
    expect(
      encounterAttackRetargetOfferDtoSchema.safeParse(
        encounterAttackRetargetOffer(gate, [{ actorId: HOLDER, tokenId: null }])
      ).success
    ).toBe(false)
    expect(
      encounterAttackRetargetOfferDtoSchema.safeParse({
        ...offer,
        options: [first, first]
      }).success
    ).toBe(false)
  })
})

describe('chosenEncounterAttackRetarget', () => {
  it('loses the action on a decline', () => {
    expect(chosenEncounterAttackRetarget(offer, { kind: 'DECLINE' })).toBeNull()
  })

  it('returns the creature an issued option names', () => {
    const [, second] = offer.options
    expect(
      chosenEncounterAttackRetarget(offer, { kind: 'OPTION', optionId: second!.useOptionId })
    ).toEqual(second)
  })

  it('refuses an option the offer never issued', () => {
    expect(() =>
      chosenEncounterAttackRetarget(offer, { kind: 'OPTION', optionId: 'not-issued' })
    ).toThrow('Retarget selection was not issued.')
  })
})

describe('retargetEncounterAction', () => {
  const command = {
    type: 'RESOLVE_ACTION',
    target: { kind: 'ACTOR', actorId: HOLDER, choiceOptionId: 'choice' },
    sceneContext: {
      sceneId: 'scene',
      expectedSceneVersion: 3,
      sourceTokenId: 'source',
      targetTokenId: 'holder-token'
    },
    acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED']
  } as unknown as ResolveEncounterActionInputDto

  it('turns the action on the creature and its token, and keeps everything else it named', () => {
    const turned = retargetEncounterAction(command, {
      targetActorId: FIRST,
      targetTokenId: FIRST_TOKEN
    })
    expect(turned).toEqual({
      ...command,
      target: { kind: 'ACTOR', actorId: FIRST, choiceOptionId: 'choice' },
      sceneContext: { ...command.sceneContext, targetTokenId: FIRST_TOKEN }
    })
  })

  it('retargets an action that names no Scene by the creature alone', () => {
    const sceneless = { ...command, sceneContext: null } as ResolveEncounterActionInputDto
    expect(
      retargetEncounterAction(sceneless, { targetActorId: FIRST, targetTokenId: null }).target
    ).toMatchObject({ actorId: FIRST })
  })

  it('refuses a Scene action turned on a creature with no token', () => {
    expect(() =>
      retargetEncounterAction(command, { targetActorId: FIRST, targetTokenId: null })
    ).toThrow('names the creature’s token')
  })

  it('refuses an action that does not aim at one creature', () => {
    expect(() =>
      retargetEncounterAction(
        { ...command, target: { kind: 'POINT' } } as unknown as ResolveEncounterActionInputDto,
        { targetActorId: FIRST, targetTokenId: FIRST_TOKEN }
      )
    ).toThrow('Only a single-target action retargets.')
  })
})
