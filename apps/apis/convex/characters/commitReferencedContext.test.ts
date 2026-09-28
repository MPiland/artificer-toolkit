import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'
import type { CharacterBuilderResolveInput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { SourceImportSubjectDto } from '@artificer-toolkit/schema/api/sourceImport'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { srdClasses } from '@artificer-toolkit/source-data/srd/classes/index.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { dwarf } from '@artificer-toolkit/source-data/srd/races/dwarf.js'
import { elf, highElf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { hillDwarfRace } from '@artificer-toolkit/source-data/srd/races/hill-dwarf.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdRaces } from '@artificer-toolkit/source-data/srd/races/index.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { fixture, input } from '../../tests/fixtures/characters'
import { importedSubject } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { prepareCharacterBuilder } from './builderPreparation'
import { loadCharacterDraftCandidate } from './documents'

// ADR 0036 S7 differential test (c): commit validation over the referenced context equals
// validation over the complete pools, including the two pool-emptiness rules and source loss.

type Test = Awaited<ReturnType<typeof fixture>>['t']
type Caller = Awaited<ReturnType<typeof fixture>>['owner']['caller']
type Intent = Partial<CharacterAuthored['intent']>

const standardArray = {
  method: 'STANDARD_ARRAY' as const,
  assignments: [
    { ability: 'STRENGTH' as const, option: '15' },
    { ability: 'DEXTERITY' as const, option: '14' },
    { ability: 'CONSTITUTION' as const, option: '13' },
    { ability: 'INTELLIGENCE' as const, option: '12' },
    { ability: 'WISDOM' as const, option: '10' },
    { ability: 'CHARISMA' as const, option: '8' }
  ]
}

async function importSubjects(t: Test, subjects: SourceImportSubjectDto[]) {
  for (let start = 0; start < subjects.length; start += 10)
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: subjects.slice(start, start + 10)
    })
}

async function publishDuplicate(
  caller: Caller,
  subjectKind: 'RACE' | 'BACKGROUND',
  subjectId: string,
  label: string
) {
  const draft = await caller.mutation(api.content.drafts.duplicate, { subjectKind, subjectId })
  const saved = await caller.mutation(api.content.drafts.save, {
    subjectKind,
    subjectId: draft.subjectId,
    systemId: draft.systemId,
    label,
    payload: { ...draft.payload, id: draft.subjectId, label }
  })
  await caller.mutation(api.content.publication.publishDraft, {
    subjectKind,
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: saved.updatedAt!
  })
  return draft.subjectId
}

/** A deterministic generator, so a failing intent can be replayed from its seed. */
function random(seed: number) {
  let state = seed
  const next = () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    return state / 2 ** 31
  }
  return {
    next,
    pick: <T>(values: readonly T[]): T => values[Math.floor(next() * values.length)]!,
    sample: <T>(values: readonly T[], count: number): T[] =>
      [...values].sort(() => next() - 0.5).slice(0, count)
  }
}

type Outcome =
  | { unavailable: string; fullReady: boolean }
  | {
      readiness: unknown
      validations: unknown
      outstandingChoices: unknown
      character: unknown
    }

async function evaluateBothWays(
  t: Test,
  userId: string,
  request: CharacterBuilderResolveInput,
  featureSourceHints: ReadonlyMap<string, string> = new Map()
): Promise<{ full: Outcome; referenced: Outcome }> {
  return t.run(async (ctx) => {
    const candidate = await loadCharacterDraftCandidate(ctx, userId, request)
    const args = () => ({
      character: structuredClone(candidate.character) as CharacterAuthored,
      current: structuredClone(candidate.current) as CharacterAuthored | null,
      mode: request.mode,
      finalize: true
    })
    const outcome = (prepared: Awaited<ReturnType<typeof prepareCharacterBuilder>>) => ({
      readiness: prepared.resolution.readiness,
      validations: prepared.resolution.validations,
      outstandingChoices: prepared.resolution.outstandingChoices,
      character: prepared.character
    })
    const full = outcome(
      await prepareCharacterBuilder(ctx, { ...args(), catalogScope: 'resolution' })
    )
    try {
      return {
        full,
        referenced: outcome(
          await prepareCharacterBuilder(ctx, {
            ...args(),
            referenced: {
              featureSourceHints,
              publications: new Map(),
              unreadableRootIds: new Set(),
              roots: new Map()
            }
          })
        )
      }
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error
      const data = error.data as { code: string; subjectId: string }
      expect(data.code).toBe('SOURCE_UNAVAILABLE')
      return {
        full: { unavailable: data.subjectId, fullReady: full.readiness.ready },
        referenced: { unavailable: data.subjectId, fullReady: false }
      }
    }
  })
}

describe('commit validation from referenced content', () => {
  it('equals complete-pool validation over the S5 corpus, generated intents and pool-size rules', async () => {
    const { t, owner, other } = await fixture()
    // The SRD, except one Tool that the Dwarf's chosen Tool proficiency lists.
    const toolGrant = dwarf.features
      ?.flatMap((feature) => feature.grants?.proficiencies ?? [])
      .find((grant) => grant.proficiencyKind === 'EQUIPMENT' && grant.selectionKind === 'CHOSEN')
    const [brewers, ...listedTools] =
      toolGrant && 'equipmentIds' in toolGrant ? (toolGrant.equipmentIds ?? []) : []
    if (!brewers || listedTools.length === 0) throw new Error('Expected the Dwarf Tool grant.')
    await importSubjects(t, [
      ...srdRaces.map((document) =>
        importedSubject({ subjectKind: 'RACE', ...document, document })
      ),
      ...srdClasses.map((document) =>
        importedSubject({ subjectKind: 'CLASS', ...document, document })
      ),
      importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte }),
      importedSubject({ subjectKind: 'FEAT', ...grappler, document: grappler }),
      ...srdEquipment
        .filter((document) => document.id !== brewers)
        .map((document) => importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })),
      ...srdSpells.map((document) =>
        importedSubject({ subjectKind: 'SPELL', ...document, document })
      )
    ])
    const homebrewParent = await publishDuplicate(owner.caller, 'RACE', elf.id, 'Moon Elf')
    const lostBackground = await publishDuplicate(
      other.caller,
      'BACKGROUND',
      acolyte.id,
      'Private acolyte'
    )
    const featFeature = grappler.features?.[0]
    const standaloneFeature = wizard.features?.[0]
    if (!featFeature || !standaloneFeature) throw new Error('Expected SRD feature fixtures.')
    const wizardCantrips = srdSpells.filter(
      (spell) => spell.level === 0 && spell.classIds?.includes(wizard.id)
    )
    const wizardSpells = srdSpells.filter((spell) => spell.classIds?.includes(wizard.id))

    const counts = { compared: 0, unavailable: 0, subclassRequired: 0, optionsUnavailable: 0 }
    // One draft carries every candidate; resolution reads the candidate, not the saved payload.
    const draft = await owner.caller.mutation(api.characters.drafts.create, input())
    function candidate(intent: Intent) {
      return characterAuthoredDtoSchema.parse({
        ...draft.payload.character,
        label: 'Differential',
        intent: { ...draft.payload.character.intent, abilities: standardArray, ...intent }
      })
    }
    async function expectEqual(
      intent: Intent,
      options: { hints?: ReadonlyMap<string, string>; unavailable?: boolean } = {}
    ) {
      const character = candidate(intent)
      const request = { expectedDraftId: draft.id, mode: 'create' as const, character }
      const { full, referenced } = await evaluateBothWays(t, owner.userId, request, options.hints)
      counts.compared += 1
      if ('unavailable' in full) {
        // Source loss fails closed where the complete pool can never be ready.
        expect(full.fullReady).toBe(false)
        counts.unavailable += 1
      } else {
        expect(referenced).toEqual(full)
        const codes = JSON.stringify([full.validations, full.outstandingChoices])
        if (codes.includes('SUBCLASS_SELECTION_REQUIRED')) counts.subclassRequired += 1
        if (codes.includes('CHOSEN_GRANT_OPTIONS_UNAVAILABLE')) counts.optionsUnavailable += 1
      }
      expect('unavailable' in full).toBe(options.unavailable ?? false)
      return full
    }

    // S5 corpus.
    await expectEqual({
      race: { raceId: human.id },
      background: { backgroundId: acolyte.id },
      classes: [{ classId: fighter.id, classLevel: 1 }]
    })
    await expectEqual({
      race: { raceId: elf.id, subraceId: highElf.id },
      background: { backgroundId: acolyte.id },
      classes: [{ classId: wizard.id, classLevel: 1 }]
    })
    await expectEqual({
      race: { raceId: dwarf.id, subraceId: hillDwarfRace.id },
      classes: [
        { classId: fighter.id, classLevel: 3, subclassId: championMartialArchetype.id },
        { classId: wizard.id, classLevel: 2 }
      ]
    })
    const acquisitions = [
      {
        id: crypto.randomUUID(),
        featureId: featFeature.id,
        source: { kind: 'FEAT' as const, featId: grappler.id },
        timing: { kind: 'IMMEDIATE' as const }
      },
      {
        id: crypto.randomUUID(),
        featureId: standaloneFeature.id,
        source: { kind: 'MANUAL' as const },
        timing: { kind: 'IMMEDIATE' as const }
      }
    ]
    const hints = new Map([[standaloneFeature.id, wizard.id]])
    await expectEqual(
      {
        race: { raceId: human.id },
        classes: [{ classId: fighter.id, classLevel: 1 }],
        featureAcquisitions: acquisitions
      },
      { hints }
    )
    await expectEqual({
      race: { raceId: homebrewParent },
      classes: [{ classId: wizard.id, classLevel: 1 }]
    })
    await expectEqual(
      {
        race: { raceId: human.id },
        background: { backgroundId: lostBackground },
        classes: [{ classId: fighter.id, classLevel: 1 }]
      },
      { unavailable: true }
    )

    // Pool-size rule 1: a due subclass with a visible subclass.
    await expectEqual({
      race: { raceId: human.id },
      classes: [{ classId: fighter.id, classLevel: 3 }]
    })

    // Pool-size rule 2: unselected chosen grants whose candidates exist.
    await expectEqual({
      race: { raceId: dwarf.id, subraceId: hillDwarfRace.id },
      classes: [{ classId: fighter.id, classLevel: 1 }]
    })
    await expectEqual({
      race: { raceId: elf.id, subraceId: highElf.id },
      classes: [{ classId: wizard.id, classLevel: 1 }],
      chosenGrantSelections: []
    })

    // Generated intents over the SRD, with chosen selections drawn from the complete pool.
    const baseRaces = srdRaces.filter((race) => race.category === 'BASE')
    const baseClasses = srdClasses.filter((record) => record.category === 'BASE')
    for (let seed = 1; seed <= 24; seed += 1) {
      const rng = random(seed)
      const race = rng.pick(baseRaces)
      const subraces = srdRaces.filter(
        (record) => record.category === 'SUBRACE' && record.parentRaceId === race.id
      )
      const baseClass = rng.pick(baseClasses)
      const subclasses = srdClasses.filter(
        (record) => record.category === 'SUBCLASS' && record.parentClassId === baseClass.id
      )
      const classLevel = 1 + Math.floor(rng.next() * 5)
      const subclass = rng.next() < 0.5 ? rng.pick(subclasses) : undefined
      const intent: Intent = {
        race: {
          raceId: race.id,
          ...(subraces.length && rng.next() < 0.7 ? { subraceId: rng.pick(subraces).id } : {})
        },
        classes: [
          {
            classId: baseClass.id,
            classLevel,
            ...(subclass && classLevel >= 3 ? { subclassId: subclass.id } : {})
          }
        ],
        ...(rng.next() < 0.6 ? { background: { backgroundId: acolyte.id } } : {}),
        ...(rng.next() < 0.5
          ? {
              spellSelections: [
                {
                  id: crypto.randomUUID(),
                  source: { kind: 'CLASS' as const, classId: baseClass.id },
                  timing: { kind: 'IMMEDIATE' as const },
                  spells: [
                    ...rng.sample(wizardCantrips, 2).map((spell) => spell.id),
                    ...rng.sample(wizardSpells, 2).map((spell) => spell.id)
                  ]
                }
              ]
            }
          : {}),
        ...(rng.next() < 0.3 ? { featureAcquisitions: acquisitions } : {})
      }
      const character = candidate(intent)
      const choices = await t.run(
        async (ctx) =>
          (
            await prepareCharacterBuilder(ctx, {
              // Validated Character DTOs bridge to the authored type as the Builder does.
              character: character as CharacterAuthored,
              current: null,
              mode: 'create',
              catalogScope: 'selectors'
            })
          ).resolution.chosenGrantChoices
      )
      intent.chosenGrantSelections = choices
        .filter(() => rng.next() < 0.7)
        .map((choice) => ({
          id: crypto.randomUUID(),
          grantId: choice.grantId,
          source: choice.source,
          timing: choice.timing,
          ...(choice.progressionLevel === undefined
            ? {}
            : { progressionLevel: choice.progressionLevel }),
          targetIds: rng
            .sample(
              choice.options,
              rng.next() < 0.8 ? choice.requiredCount : choice.requiredCount + 1
            )
            .map((option) => option.id)
        }))
      await expectEqual(intent, { hints, unavailable: false })
    }

    // Pool-size rule 1 with no visible subclass: another user's private subclass does not count.
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', championMartialArchetype.id))
        .unique()
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
          q.eq('gameSystemId', fighter.systemId).eq('kind', 'USER').eq('ownerUserId', other.userId)
        )
        .first()
      if (!root || !source) throw new Error('Missing Champion or Homebrew source fixture.')
      await ctx.db.patch(root._id, { contentSourceId: source.id, ownerUserId: other.userId })
    })
    const withoutSubclass = await expectEqual({
      race: { raceId: human.id },
      classes: [{ classId: fighter.id, classLevel: 3 }]
    })
    expect(JSON.stringify(withoutSubclass)).not.toContain('SUBCLASS_SELECTION_REQUIRED')

    // The Dwarf lists a Tool no source holds; with every listed Tool gone, its grant is empty.
    await t.run(async (ctx) => {
      for (const id of listedTools) {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
        if (root) await ctx.db.delete(root._id)
      }
    })
    await expectEqual({
      race: { raceId: dwarf.id, subraceId: hillDwarfRace.id },
      classes: [{ classId: fighter.id, classLevel: 1 }]
    })

    expect(counts.subclassRequired).toBeGreaterThan(0)
    expect(counts.optionsUnavailable).toBeGreaterThan(0)
    expect(counts.unavailable).toBeGreaterThan(0)
    console.info('S7 differential coverage', counts)
  }, 600_000)
})
