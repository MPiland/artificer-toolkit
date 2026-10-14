import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { SRD_DARKVISION_SENSE_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { deriveActorSceneVision } from '../actorSenses.js'
import { resolveCharacterRecordStats } from '../character/characterRecordStats.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  system
} from '../testing/characterContextFixtures.js'

const walk = system.speeds.find((speed) => speed.code === 'WALK')
if (!walk) throw new Error('Expected the SRD walking Speed.')

const fly = system.speeds.find((speed) => speed.code === 'FLY')
if (!fly) throw new Error('Expected the SRD flying Speed.')
const darkvision = SRD_SENSE_DEFINITIONS.find((sense) => sense.id === SRD_DARKVISION_SENSE_ID)
if (!darkvision) throw new Error('Expected the SRD darkvision Sense.')

type LengthModifier = {
  valueDomainCode: 'SPEED' | 'SENSE_RANGE'
  domain: Record<string, string>
  modifierKind: 'BONUS' | 'PENALTY' | 'SET_VALUE'
  payload: { amount: number; unit: 'FEET' | 'YARDS' | 'MILES' }
}
const speedModifier = (
  modifierKind: LengthModifier['modifierKind'],
  payload: LengthModifier['payload'],
  speedId = walk.id
): LengthModifier => ({ valueDomainCode: 'SPEED', domain: { speedId }, modifierKind, payload })
const darkvisionBonus = (payload: LengthModifier['payload']): LengthModifier => ({
  valueDomainCode: 'SENSE_RANGE',
  domain: { senseDefinitionId: SRD_DARKVISION_SENSE_ID },
  modifierKind: 'BONUS',
  payload
})

/** A race whose speed and darkvision are authored in yards and whose feature grants the modifiers. */
const raceWith = (modifiers: readonly LengthModifier[], walkAmount = 10) => ({
  ...human,
  speeds: [{ speedId: walk.id, amount: walkAmount, unit: 'YARDS' as const }],
  features: [
    {
      id: crypto.randomUUID(),
      label: 'Far Reach',
      description: 'Your speed and darkvision reach further.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        senses: [
          {
            id: crypto.randomUUID(),
            grantKind: 'SENSE_GRANT' as const,
            selectionKind: 'GRANTED' as const,
            scalingKind: 'NONE' as const,
            authoringModeKind: 'SELECTED' as const,
            senseIds: [SRD_DARKVISION_SENSE_ID],
            range: {
              id: crypto.randomUUID(),
              rangeKind: 'DISTANCE' as const,
              amount: 18,
              unit: 'YARDS' as const
            },
            order: 0
          }
        ],
        modifiers: modifiers.map((modifier, order) => ({
          id: crypto.randomUUID(),
          grantKind: 'MODIFIER_GRANT' as const,
          scope: 'GLOBAL' as const,
          selectionKind: 'GRANTED' as const,
          order,
          ...modifier
        }))
      }
    }
  ]
})

const FEET_30 = { amount: 30, unit: 'FEET' as const }
const metricHuman = raceWith([speedModifier('BONUS', FEET_30), darkvisionBonus(FEET_30)])

const prepare = async (race: typeof metricHuman) => {
  const fixture = readyFighterFixture()
  const documents = { ...fixture.documents, RACE: [race] }
  const { character } = await prepareFixtureBuilder({ character: fixture.character, documents })
  return prepareFixtureSheet({ character, documents })
}

describe('a Character whose speed and sense are authored in yards gains a bonus authored in feet', () => {
  it('shows the converted speed and sense range on the Sheet read model', async () => {
    const { sheet } = await prepare(metricHuman)

    // 10 yd + 30 ft = 10 yd + 10 yd; 18 yd + 30 ft = 18 yd + 10 yd.
    expect(sheet.overview.facts.find((fact) => fact.label === 'Speed')?.value).toBe('20 yards')
    expect(sheet.reference.senses).toEqual([
      expect.objectContaining({ senseId: SRD_DARKVISION_SENSE_ID, value: '28 yards' })
    ])
  })

  it('stores the converted speed in feet for the Scene token to move by', async () => {
    const { ruleEvaluation } = await prepare(metricHuman)

    expect(resolveCharacterRecordStats(ruleEvaluation).speeds).toEqual([
      { speedId: walk.id, amount: 60, unit: 'FEET' }
    ])
  })

  it('gives the Scene token the converted sense range in feet', async () => {
    const { ruleEvaluation } = await prepare(metricHuman)
    const vision = deriveActorSceneVision(
      crypto.randomUUID(),
      ruleEvaluation.output.senses.map((sense) => ({
        document: darkvision.document,
        label: darkvision.label,
        range: sense.range
      }))
    )

    // 18 yd + 30 ft = 28 yd = 84 ft.
    expect(vision.senses).toEqual([
      expect.objectContaining({
        senseId: SRD_DARKVISION_SENSE_ID,
        range: { rangeKind: 'DISTANCE', amount: 84, unit: 'FEET' }
      })
    ])
  })

  it('shows a conversion that does not divide evenly rounded to three decimals', async () => {
    const { sheet } = await prepare(raceWith([speedModifier('BONUS', { amount: 5, unit: 'FEET' })]))

    // 10 yd + 5 ft = 10 yd + 1.6666... yd.
    expect(sheet.overview.facts.find((fact) => fact.label === 'Speed')?.value).toBe(
      '11.667 yards'
    )
  })
})

describe('a feature granting a speed the Character has no base for', () => {
  const flyGrant = raceWith([speedModifier('SET_VALUE', { amount: 12, unit: 'YARDS' }, fly.id)])

  it('keeps the Character saveable and stores the granted speed in feet', async () => {
    const { ruleEvaluation } = await prepare(flyGrant)

    expect(ruleEvaluation.output.movement.speeds).toContainEqual(
      expect.objectContaining({ speedId: fly.id, amount: 12, unit: 'YARDS' })
    )
    expect(resolveCharacterRecordStats(ruleEvaluation).speeds).toContainEqual({
      speedId: fly.id,
      amount: 36,
      unit: 'FEET'
    })
  })
})

describe('a penalty larger than the speed it reduces', () => {
  it('leaves the Character a speed of zero rather than a negative one', async () => {
    const { ruleEvaluation, sheet } = await prepare(
      raceWith([speedModifier('PENALTY', { amount: 40, unit: 'FEET' })], 10)
    )

    // 10 yd = 30 ft; a 40 ft penalty floors at 0.
    expect(resolveCharacterRecordStats(ruleEvaluation).speeds).toEqual([
      { speedId: walk.id, amount: 0, unit: 'FEET' }
    ])
    expect(sheet.overview.facts.find((fact) => fact.label === 'Speed')?.value).toBe('0 yards')
  })
})
