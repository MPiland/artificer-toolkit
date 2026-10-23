import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import { SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { characterBuilderSectionOfSource } from '../character/builderPresentation.js'
import { resolveCharacterRecordStats } from '../character/characterRecordStats.js'
import {
  emptyCharacter,
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture
} from '../testing/characterContextFixtures.js'

const unknownId = '60000000-0000-4000-8000-000000000001'

/** The fixture's language choice, selected with its first two options. */
async function selectLanguages(
  fixture: ReturnType<typeof readyFighterFixture>,
  count = 2
): Promise<CharacterAuthored> {
  const { resolution } = await prepareFixtureBuilder(fixture)
  const choice = resolution.chosenGrantChoices[0]
  if (!choice) throw new Error('Expected the Acolyte language choice.')
  return {
    ...fixture.character,
    intent: {
      ...fixture.character.intent,
      chosenGrantSelections: [
        {
          id: crypto.randomUUID(),
          grantId: choice.grantId,
          source: choice.source,
          timing: choice.timing,
          targetIds: choice.options.slice(0, count).map((option) => option.id)
        }
      ]
    }
  }
}

describe('Character Builder over an in-memory context', () => {
  it('resolves a complete Character as ready and starts it at full hit points', async () => {
    const fixture = readyFighterFixture()
    const { character, resolution } = await prepareFixtureBuilder(fixture)
    expect(resolution.readiness.ready).toBe(true)
    expect(resolution.summary.totalLevel).toBe(1)
    expect(character.state.hitpoints.current).toBeGreaterThan(0)
    // The class's required Resource grant is added to a Character that never recorded it.
    expect(character.intent.resourceGrants?.map((grant) => grant.resourceId)).toEqual([
      fixture.shortRestResource.id
    ])
  })

  it('leaves an empty draft not ready with its choices outstanding', async () => {
    const { resolution } = await prepareFixtureBuilder({
      character: emptyCharacter(),
      documents: readyFighterFixture().documents
    })
    expect(resolution.readiness.ready).toBe(false)
    expect(resolution.readiness.blockingIssues.length).toBeGreaterThan(0)
  })

  it.each([
    { selected: 0, outstanding: 'CHOSEN_GRANT_SELECTION_REQUIRED', ready: false },
    { selected: 1, outstanding: 'CHOSEN_GRANT_SELECTION_INCOMPLETE', ready: false },
    { selected: 2, outstanding: undefined, ready: true }
  ])('resolves a chosen-grant choice with $selected of 2 selections', async (scenario) => {
    const fixture = readyFighterFixture({ languageChoice: true })
    const character =
      scenario.selected === 0
        ? fixture.character
        : await selectLanguages(fixture, scenario.selected)
    const { resolution } = await prepareFixtureBuilder({ ...fixture, character })
    expect(resolution.chosenGrantChoices).toHaveLength(1)
    expect(resolution.chosenGrantChoices[0]?.requiredCount).toBe(2)
    expect(resolution.outstandingChoices.map((choice) => choice.code)).toEqual(
      scenario.outstanding ? [scenario.outstanding] : []
    )
    expect(resolution.readiness.ready).toBe(scenario.ready)
  })

  it('names the section that owns each issue, from the source that raised it', async () => {
    const fixture = readyFighterFixture({ languageChoice: true })
    const { resolution } = await prepareFixtureBuilder(fixture)
    expect(resolution.outstandingChoices).toEqual([
      expect.objectContaining({
        code: 'CHOSEN_GRANT_SELECTION_REQUIRED',
        sectionId: 'BACKGROUND'
      })
    ])
  })

  it.each([
    { source: { kind: 'ANCESTRY', ancestryId: unknownId, optionId: unknownId }, section: 'RACE' },
    { source: { kind: 'SUBCLASS', subclassId: unknownId, classLevel: 3 }, section: 'CLASSES' },
    { source: { kind: 'BACKGROUND', backgroundId: unknownId }, section: 'BACKGROUND' },
    { source: { kind: 'FEAT', featId: unknownId }, section: 'REVIEW' },
    { source: undefined, section: 'REVIEW' }
  ] as const)('files an issue raised by $source.kind under $section', ({ source, section }) => {
    expect(characterBuilderSectionOfSource(source)).toBe(section)
  })

  it('keeps a chosen-grant selection that still matches and drops one that no longer does', async () => {
    const fixture = readyFighterFixture({ languageChoice: true })
    const selected = await selectLanguages(fixture)
    const [selection] = selected.intent.chosenGrantSelections!
    const stale = {
      ...selected,
      intent: {
        ...selected.intent,
        chosenGrantSelections: [
          selection!,
          { ...selection!, id: crypto.randomUUID(), grantId: unknownId }
        ]
      }
    }
    const { character } = await prepareFixtureBuilder({ ...fixture, character: stale })
    expect(character.intent.chosenGrantSelections).toEqual([selection])
  })

  it('drops selections and Resource grants whose source the Character no longer has', async () => {
    const fixture = readyFighterFixture()
    const feature = { kind: 'FEATURE' as const, featureId: unknownId }
    const timing = { kind: 'IMMEDIATE' as const }
    const classId = fixture.character.intent.classes[0]!.classId
    const { character } = await prepareFixtureBuilder({
      documents: { ...fixture.documents, SPELL: [fireBolt] },
      character: {
        ...fixture.character,
        intent: {
          ...fixture.character.intent,
          spellSelections: [{ id: unknownId, source: feature, timing, spells: [fireBolt.id] }],
          resourceGrants: [
            { id: unknownId, resourceId: unknownId, source: feature, timing },
            {
              id: crypto.randomUUID(),
              resourceId: unknownId,
              source: { kind: 'CLASS', classId, classLevel: 1 },
              timing: { kind: 'CLASS_LEVEL', classId, classLevel: 1 }
            }
          ]
        }
      }
    })
    expect(character.intent.spellSelections).toBeUndefined()
    expect(character.intent.resourceGrants?.map((grant) => grant.resourceId)).toEqual([
      fixture.shortRestResource.id
    ])
  })

  it('keeps the stored hit points when it reconciles an existing Character', async () => {
    const fixture = readyFighterFixture()
    const { character: created } = await prepareFixtureBuilder(fixture)
    const damaged = {
      ...created,
      state: { ...created.state, hitpoints: { ...created.state.hitpoints, current: 3 } }
    }
    const { character } = await prepareFixtureBuilder({
      ...fixture,
      character: damaged,
      current: damaged
    })
    expect(character.state.hitpoints.current).toBe(3)
  })
})

describe('Character record stats', () => {
  it('derives the effective maximum hit points and typed speeds from the rules evaluation', async () => {
    const fixture = readyFighterFixture()
    const { character } = await prepareFixtureBuilder(fixture)
    const { ruleEvaluation } = await prepareFixtureSheet({ ...fixture, character })
    const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
    expect(resolveCharacterRecordStats(ruleEvaluation)).toEqual({
      maximumHitPoints: 11,
      speeds: [{ speedId: walkSpeedId, amount: 30, unit: 'FEET' }]
    })
  })
})
