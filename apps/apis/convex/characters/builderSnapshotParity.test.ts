import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  ShareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { CharacterBuilderResolveInput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { ContentSnapshotObject } from '@artificer-toolkit/schema/api/contentSnapshots'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { SourceImportSubjectDto } from '@artificer-toolkit/schema/api/sourceImport'
import {
  resolveSnapshotCharacterBuilderPayload,
  type SnapshotCharacterBuilderInput
} from '@artificer-toolkit/rules-runtime/character/snapshotBuilderEvaluation'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { srdClasses } from '@artificer-toolkit/source-data/srd/classes/index.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { elf, highElf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { dwarf } from '@artificer-toolkit/source-data/srd/races/dwarf.js'
import { hillDwarfRace } from '@artificer-toolkit/source-data/srd/races/hill-dwarf.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdRaces } from '@artificer-toolkit/source-data/srd/races/index.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture, input } from '../../tests/fixtures/characters'
import { evaluateBuilderCandidate } from '../../tests/fixtures/builderEvaluation'
import { createBrowserReaders } from '../../tests/fixtures/contentSnapshotReaders'
import { importedSubject, importSeededSubjects, makePublishedRootOwned } from '../../tests/fixtures/publication'
import { readyCharacterFixture, readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'
import { readAuthoredVersion, readPublishedDocument } from '../content/documents'
import { parsePublicationDocument } from '../content/publicationDocumentRead'

// ADR 0036 S5, S9: the Builder evaluated from content snapshot objects, as the browser does, must
// produce the payload of a pure full-pool evaluation over the publications Convex authorizes.

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const share = makeFunctionReference<'mutation', ShareCampaignContentInput, unknown>(
  'campaigns/contentShares:share'
)

type Test = Awaited<ReturnType<typeof fixture>>['t']
type Caller = Awaited<ReturnType<typeof fixture>>['owner']['caller']

/**
 * Resolves and previews through the browser's lazy snapshot readers and over the pure full pool,
 * and returns both with the snapshot objects and the browser evaluation input.
 */
async function resolveBothWays(
  t: Test,
  caller: Caller,
  userId: string,
  request: CharacterBuilderResolveInput,
  scopeReads?: Parameters<typeof evaluateBuilderCandidate>[4]
) {
  const evaluation = await evaluateBuilderCandidate(t, caller, userId, request, scopeReads)
  return {
    local: await evaluation.resolve(),
    localPreview: await evaluation.preview(),
    fullPool: await evaluation.fullPoolResolve(),
    fullPoolPreview: await evaluation.fullPoolPreview(),
    objects: evaluation.objects,
    input: evaluation.input,
    loadedKinds: evaluation.loadedKinds
  }
}
/**
 * Warm evaluation time per resolve, in milliseconds, with the parsed objects already held, as the
 * browser worker holds them after the first evaluation of a manifest.
 */
async function timeWarmResolves(
  cases: readonly {
    input: SnapshotCharacterBuilderInput
    objects: readonly ContentSnapshotObject[]
  }[],
  repetitions: number
) {
  const durations: number[] = []
  for (const { input, objects } of cases) {
    const { readers } = createBrowserReaders(objects)
    await resolveSnapshotCharacterBuilderPayload(input, readers)
    for (let run = 0; run < repetitions; run++) {
      const started = performance.now()
      await resolveSnapshotCharacterBuilderPayload(input, readers)
      durations.push(performance.now() - started)
    }
  }
  return durations.sort((left, right) => left - right)
}

/** Every snapshot document equals the Convex publication read of the same root. */
async function expectDocumentsRoundTrip(t: Test, objects: readonly ContentSnapshotObject[]) {
  const documents = objects.flatMap((object) =>
    object.part === 'documents'
      ? object.roots.map((document) => ({ kind: object.kind, document }))
      : []
  )
  expect(documents.length).toBeGreaterThan(0)
  const published = await t.run(async (ctx) => {
    const read = []
    for (const { document } of documents) {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', document.id))
        .unique()
      if (!root) throw new Error('Snapshot root is missing from Convex.')
      read.push(
        parsePublicationDocument(
          root.subjectKind,
          await readPublishedDocument(ctx, root, await readAuthoredVersion(ctx, root))
        )
      )
    }
    return read
  })
  expect(published).toEqual(
    documents.map(({ kind, document }) => ({ subjectKind: kind, document }))
  )
}

async function importSrd(t: Test, subjects: SourceImportSubjectDto[]) {
  for (let start = 0; start < subjects.length; start += 10)
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: subjects.slice(start, start + 10)
    })
}

async function publishDuplicate(
  caller: Caller,
  subjectKind: 'RACE' | 'BACKGROUND',
  subjectId: string,
  label: string,
  patch: Record<string, unknown> = {}
) {
  const draft = await caller.mutation(api.content.drafts.duplicate, { subjectKind, subjectId })
  const saved = await caller.mutation(api.content.drafts.save, {
    subjectKind,
    subjectId: draft.subjectId,
    systemId: draft.systemId,
    label,
    payload: { ...draft.payload, ...patch, id: draft.subjectId, label }
  })
  await caller.mutation(api.content.publication.publishDraft, {
    subjectKind,
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: saved.updatedAt!
  })
  return draft.subjectId
}

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

describe('Builder resolution from content snapshots', () => {
  it('matches the full pool over SRD, Homebrew and lost sources, and round-trips every root', async () => {
    const { t, owner, other } = await fixture()
    await importSrd(t, [
      ...srdRaces.map((document) =>
        importedSubject({ subjectKind: 'RACE', ...document, document })
      ),
      ...srdClasses.map((document) =>
        importedSubject({ subjectKind: 'CLASS', ...document, document })
      ),
      importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte }),
      importedSubject({ subjectKind: 'FEAT', ...grappler, document: grappler }),
      ...srdEquipment.map((document) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
      ),
      ...srdSpells.map((document) =>
        importedSubject({ subjectKind: 'SPELL', ...document, document })
      )
    ])
    const homebrewParent = await publishDuplicate(owner.caller, 'RACE', elf.id, 'Moon Elf')
    const homebrewChild = await publishDuplicate(owner.caller, 'RACE', highElf.id, 'Moon Scholar', {
      parentRaceId: homebrewParent
    })
    const lostBackground = await publishDuplicate(
      other.caller,
      'BACKGROUND',
      acolyte.id,
      'Private acolyte'
    )
    const featFeature = grappler.features?.[0]
    const standaloneFeature = wizard.features?.[0]
    if (!featFeature || !standaloneFeature) throw new Error('Expected SRD feature fixtures.')

    const scenarios: Array<Partial<CharacterAuthored['intent']>> = [
      // Fighter.
      {
        race: { raceId: human.id },
        background: { backgroundId: acolyte.id },
        classes: [{ classId: fighter.id, classLevel: 1 }]
      },
      // Wizard with an SRD subrace, reading the Spell catalogue.
      {
        race: { raceId: elf.id, subraceId: highElf.id },
        background: { backgroundId: acolyte.id },
        classes: [{ classId: wizard.id, classLevel: 1 }]
      },
      // Multiclass with a due subclass.
      {
        race: { raceId: dwarf.id, subraceId: hillDwarfRace.id },
        classes: [
          { classId: fighter.id, classLevel: 3, subclassId: championMartialArchetype.id },
          { classId: wizard.id, classLevel: 2 }
        ]
      },
      // A Feat feature and a standalone feature found through the feature source scan.
      {
        race: { raceId: human.id },
        classes: [{ classId: fighter.id, classLevel: 1 }],
        featureAcquisitions: [
          {
            id: crypto.randomUUID(),
            featureId: featFeature.id,
            source: { kind: 'FEAT', featId: grappler.id },
            timing: { kind: 'IMMEDIATE' }
          },
          {
            id: crypto.randomUUID(),
            featureId: standaloneFeature.id,
            source: { kind: 'MANUAL' },
            timing: { kind: 'IMMEDIATE' }
          }
        ]
      },
      // Homebrew parent and child.
      {
        race: { raceId: homebrewParent, subraceId: homebrewChild },
        classes: [{ classId: wizard.id, classLevel: 1 }]
      },
      // Source loss: another user's private Background.
      {
        race: { raceId: human.id },
        background: { backgroundId: lostBackground },
        classes: [{ classId: fighter.id, classLevel: 1 }]
      }
    ]

    // Published content is unchanged across the scenarios, so they share one snapshot read per scope.
    const scopeReads: Parameters<typeof resolveBothWays>[4] = new Map()

    async function expectParity(intent: Partial<CharacterAuthored['intent']>) {
      const draft = await owner.caller.mutation(api.characters.drafts.create, input())
      const character = characterAuthoredDtoSchema.parse({
        ...draft.payload.character,
        label: 'Parity',
        intent: { ...draft.payload.character.intent, abilities: standardArray, ...intent }
      })
      const request = { expectedDraftId: draft.id, mode: 'create' as const, character }
      const resolved = await resolveBothWays(t, owner.caller, owner.userId, request, scopeReads)
      expect(resolved.local).toEqual(resolved.fullPool)
      expect(resolved.localPreview).toEqual(resolved.fullPoolPreview)
      return { ...resolved, request }
    }

    const results = []
    for (const intent of scenarios) results.push(await expectParity(intent))
    const [fighterResult, wizardResult, , , homebrewResult, lossResult] = results
    // Documents load per kind as evaluation reads them: a Fighter never fetches Spells or Creatures.
    expect(new Set(fighterResult!.loadedKinds)).toEqual(new Set(['RACE', 'CLASS', 'BACKGROUND']))
    // The Spell picker reads index entries; Spell documents load only for referenced Spells.
    expect(new Set(wizardResult!.loadedKinds)).not.toContain('SPELL')
    // ADR 0036 S6 gate: warm evaluation p95 at most 100 ms over the corpus, as a Node proxy.
    const durations = await timeWarmResolves(results, 5)
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1]!
    expect(p95, `warm evaluation p95 ${p95.toFixed(1)} ms`).toBeLessThanOrEqual(100)
    // The corpus reaches the paths it is meant to cover.
    const cantrip = srdSpells.find(
      (spell) => spell.level === 0 && spell.classIds?.includes(wizard.id)
    )
    expect(JSON.stringify(wizardResult!.fullPool.view)).toContain(cantrip!.label)
    expect(homebrewResult!.fullPool.resolution.summary.selectedRace).toMatchObject({
      raceLabel: 'Moon Elf',
      subraceLabel: 'Moon Scholar'
    })
    expect(JSON.stringify(lossResult!.fullPool)).not.toContain('Private acolyte')

    await expectDocumentsRoundTrip(
      t,
      [...lossResult!.objects, ...homebrewResult!.objects].filter(
        (object, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.scopeId === object.scopeId &&
              candidate.kind === object.kind &&
              candidate.part === object.part
          ) === index
      )
    )
  }, 240_000)

  it('matches the full pool for a Campaign-shared subclass under the Campaign text policy', async () => {
    const base = await readySheetFixture()
    const { t, owner, other, character } = base
    // Drafts cannot duplicate Classes; own an imported copy as the GM's Homebrew instead.
    const sharedSubclass = crypto.randomUUID()
    const homebrewSubclass = {
      ...championMartialArchetype,
      id: sharedSubclass,
      label: 'Shitstorm champion'
    }
    await importSrd(
      t,
      [championMartialArchetype, homebrewSubclass].map((document) =>
        importedSubject({ subjectKind: 'CLASS', ...document, document })
      )
    )
    await t.run((ctx) => makePublishedRootOwned(ctx, sharedSubclass, other.userId))
    const campaign = await other.caller.mutation(createCampaign, {
      name: 'Snapshot parity',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: owner.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: campaign.id,
        userId: owner.userId,
        characterId: character.id,
        assignedAt: campaign.createdAt
      })
    })
    const unshared = await publishDuplicate(other.caller, 'BACKGROUND', acolyte.id, 'Unshared')
    await other.caller.mutation(share, {
      campaignId: campaign.id,
      subjectKind: 'CLASS',
      subjectId: sharedSubclass
    })
    const edit = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: character.id
    })
    const candidate = characterAuthoredDtoSchema.parse({
      ...edit.payload.character,
      intent: {
        ...edit.payload.character.intent,
        background: { backgroundId: unshared },
        classes: [{ classId: base.baseClass.id, classLevel: 3, subclassId: sharedSubclass }]
      }
    })
    const { fullPool, local, fullPoolPreview, localPreview, objects } = await resolveBothWays(
      t,
      owner.caller,
      owner.userId,
      { expectedDraftId: edit.id, mode: 'edit', character: candidate }
    )
    expect(local).toEqual(fullPool)
    expect(localPreview).toEqual(fullPoolPreview)
    expect(objects.some((object) => object.scope === 'CAMPAIGN')).toBe(true)
    expect(JSON.stringify(fullPool.view)).toContain(sharedSubclass)
    expect(JSON.stringify(fullPool)).not.toContain('Shitstorm')
    await expectDocumentsRoundTrip(t, objects)
  }, 120_000)

  it('matches the full pool for level-up edits of an active Character and its replacement allowance', async () => {
    const base = await readyCharacterFixture()
    const { t, owner, other, baseClass } = base
    const featureId = crypto.randomUUID()
    const noviceId = crypto.randomUUID()
    const veteranId = crypto.randomUUID()
    // One option at level 1, and one replacement allowed on reaching level 2.
    const race = {
      ...human,
      id: crypto.randomUUID(),
      label: 'Trained human',
      features: [
        {
          id: featureId,
          label: 'Training',
          description: '',
          order: 0,
          availableAtLevel: 1,
          optionChoices: [
            { level: 1, count: 1 },
            { level: 2, count: 0, replaceCount: 1 }
          ],
          options: [
            { id: noviceId, label: 'Novice', description: '', order: 0 },
            { id: veteranId, label: 'Veteran', description: '', order: 1 }
          ]
        }
      ]
    }
    await importSrd(t, [importedSubject({ subjectKind: 'RACE', ...race, document: race })])
    const training = (optionId: string) => ({
      id: crypto.randomUUID(),
      featureId,
      source: { kind: 'RACE' as const, raceId: race.id },
      timing: { kind: 'CHARACTER_LEVEL' as const, level: 1 },
      selections: [{ selectionKey: 'options', values: [{ kind: 'IDS' as const, ids: [optionId] }] }]
    })
    const { draft, character } = await base.createCharacter()
    await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character: characterAuthoredDtoSchema.parse({
        ...character,
        intent: {
          ...character.intent,
          race: { raceId: race.id },
          featureAcquisitions: [training(noviceId)]
        }
      })
    })
    expect(
      await other.caller.query(api.characters.builder.activeCharacter, { id: character.id })
    ).toBeNull()
    const edit = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: character.id
    })
    const edited = (classLevel: number) =>
      characterAuthoredDtoSchema.parse({
        ...edit.payload.character,
        intent: {
          ...edit.payload.character.intent,
          classes: [{ classId: baseClass.id, classLevel }],
          hitpoints: {
            method: 'FIXED',
            levels: [
              { level: 1, classId: baseClass.id, classLevel: 1, value: 10 },
              ...(classLevel === 2
                ? [{ level: 2, classId: baseClass.id, classLevel: 2, value: 6 }]
                : [])
            ]
          },
          featureAcquisitions: [training(veteranId)]
        }
      })

    const replacementCode = 'FEATURE_SELECTION_REPLACEMENT_OVER_LIMIT'
    for (const [classLevel, overLimit] of [
      [2, false],
      [1, true]
    ] as const) {
      const { fullPool, local, fullPoolPreview, localPreview } = await resolveBothWays(
        t,
        owner.caller,
        owner.userId,
        { expectedDraftId: edit.id, mode: 'edit', character: edited(classLevel) }
      )
      expect(local).toEqual(fullPool)
      expect(localPreview).toEqual(fullPoolPreview)
      // The swap is allowed only by the level reached since the active Character.
      expect(fullPool.resolution.validations.some((issue) => issue.code === replacementCode)).toBe(
        overLimit
      )
    }
  }, 120_000)
})
