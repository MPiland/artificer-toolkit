import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  ShareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characterBuilder'
import type { CharacterBuilderResolveInput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  contentSnapshotKindSchema,
  type ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { SourceImportSubjectDto } from '@artificer-toolkit/schema/api/sourceImport'
import { resolveCharacterBuilderPayload } from '@artificer-toolkit/rules-runtime/character/builderPayload'
import {
  assembleCharacterBuilderContext,
  prepareCharacterRuleContext
} from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import { createSnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import {
  buildContentSnapshotKind,
  type ContentSnapshotIndexSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
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
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
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
import { importedSubject, makePublishedRootOwned } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api, internal } from '../_generated/api'
import { readAuthoredVersion, readPublishedDocument } from '../content/documents'
import { parsePublicationDocument } from '../content/publicationDocumentRead'
import { requireSystem } from '../content/systemDocuments'
import type { ContentSnapshotScopeRef } from '../contentSnapshots/marking'
import { readCharacterSources } from './context'
import { loadCharacterDraftCandidate } from './documents'

// ADR 0036 S5: the Builder evaluated purely from content snapshot objects must produce the payload
// `builder.resolve` produces from Convex reads, over the same authorized sources.

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const share = makeFunctionReference<'mutation', ShareCampaignContentInput, unknown>(
  'campaigns/contentShares:share'
)

type Test = Awaited<ReturnType<typeof fixture>>['t']
type Caller = Awaited<ReturnType<typeof fixture>>['owner']['caller']

/** The S2 build's objects for one scope, parsed back as a browser would read them. */
async function readScopeObjects(t: Test, ref: ContentSnapshotScopeRef) {
  const objects: ContentSnapshotObject[] = []
  for (const kind of contentSnapshotKindSchema.options) {
    const sources: ContentSnapshotIndexSource[] = []
    let cursor: string | null = null
    for (let isDone = false; !isDone; ) {
      const page: { sources: string[]; continueCursor: string; isDone: boolean } = await t.query(
        internal.contentSnapshots.heads.readScopeKind,
        { ...ref, kind, paginationOpts: { numItems: 100, cursor } }
      )
      for (const json of page.sources) sources.push(JSON.parse(json) as ContentSnapshotIndexSource)
      cursor = page.continueCursor
      isDone = page.isDone
    }
    if (sources.length === 0) continue
    const { index, documents } = buildContentSnapshotKind({ format: 1, ...ref, kind }, sources)
    objects.push(
      contentSnapshotIndexObjectSchema.parse(JSON.parse(index.json)),
      contentSnapshotDocumentsObjectSchema.parse(JSON.parse(documents.json))
    )
  }
  return objects
}

/** Resolves on the server and from snapshots, and returns both with the snapshot objects. */
async function resolveBothWays(
  t: Test,
  caller: Caller,
  userId: string,
  request: CharacterBuilderResolveInput
) {
  const server = await caller.query(api.characters.builder.resolve, request)
  const { candidate, system, sources } = await t.run(async (ctx) => {
    const candidate = await loadCharacterDraftCandidate(ctx, userId, request)
    return {
      candidate,
      system: await requireSystem(ctx, request.character.systemId),
      sources: await readCharacterSources(ctx, candidate.character, userId)
    }
  })
  const scopes: ContentSnapshotScopeRef[] = [
    ...sources.sources.map((source) => ({ scope: 'SOURCE' as const, scopeId: source.id })),
    ...(sources.campaign ? [{ scope: 'CAMPAIGN' as const, scopeId: sources.campaign.id }] : [])
  ]
  const objects = (await Promise.all(scopes.map((ref) => readScopeObjects(t, ref)))).flat()
  // Validated Character DTOs use literal starting-equipment sources for the authored string enum.
  const previousCharacter = candidate.current as CharacterAuthored | null
  const draftCharacter = candidate.character as CharacterAuthored
  const character = {
    ...draftCharacter,
    state: previousCharacter?.state ?? createEmptyCharacterAuthored(draftCharacter).state
  }
  const readers = createSnapshotReaders(objects)
  const context = await assembleCharacterBuilderContext(
    character,
    await prepareCharacterRuleContext(character, system, undefined, readers),
    readers,
    'selectors'
  )
  const local: CharacterBuilderPayloadDto = await resolveCharacterBuilderPayload(
    character,
    context,
    {
      mode: request.mode,
      previousCharacter,
      builderIntent: candidate.draft.payload.builderIntent,
      publicId: candidate.draft.publicId,
      baseActiveUpdatedAt: candidate.draft.baseActiveUpdatedAt ?? null,
      contentMaturity: sources.campaign?.contentMaturity ?? null
    }
  )
  return { server, local, objects }
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
    await t.mutation(internal.content.import.importSubjects, {
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
  it('matches builder.resolve over SRD, Homebrew and lost sources, and round-trips every root', async () => {
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

    async function expectParity(intent: Partial<CharacterAuthored['intent']>) {
      const draft = await owner.caller.mutation(api.characters.drafts.create, input())
      const character = characterAuthoredDtoSchema.parse({
        ...draft.payload.character,
        label: 'Parity',
        intent: { ...draft.payload.character.intent, abilities: standardArray, ...intent }
      })
      const request = { expectedDraftId: draft.id, mode: 'create' as const, character }
      const resolved = await resolveBothWays(t, owner.caller, owner.userId, request)
      expect(resolved.local).toEqual(resolved.server)
      return { ...resolved, request }
    }

    const results = []
    for (const intent of scenarios) results.push(await expectParity(intent))
    const [, wizardResult, , , homebrewResult, lossResult] = results
    // The corpus reaches the paths it is meant to cover.
    const cantrip = srdSpells.find(
      (spell) => spell.level === 0 && spell.classIds?.includes(wizard.id)
    )
    expect(JSON.stringify(wizardResult!.server.view)).toContain(cantrip!.label)
    expect(homebrewResult!.server.resolution.summary.selectedRace).toMatchObject({
      raceLabel: 'Moon Elf',
      subraceLabel: 'Moon Scholar'
    })
    expect(JSON.stringify(lossResult!.server)).not.toContain('Private acolyte')

    // A missing stored Equipment projection sends Convex through document resolution.
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', club.id))
        .unique()
      if (!root) throw new Error('Missing Equipment fixture.')
      await ctx.db.patch(root._id, { equipmentOptions: undefined })
    })
    const fighterRequest = results[0]!.request
    const withoutProjection = await resolveBothWays(t, owner.caller, owner.userId, fighterRequest)
    expect(withoutProjection.local).toEqual(withoutProjection.server)

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

  it('matches builder.resolve for a Campaign-shared subclass under the Campaign text policy', async () => {
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
    const { server, local, objects } = await resolveBothWays(t, owner.caller, owner.userId, {
      expectedDraftId: edit.id,
      mode: 'edit',
      character: candidate
    })
    expect(local).toEqual(server)
    expect(objects.some((object) => object.scope === 'CAMPAIGN')).toBe(true)
    expect(JSON.stringify(server.view)).toContain(sharedSubclass)
    expect(JSON.stringify(server)).not.toContain('Shitstorm')
    await expectDocumentsRoundTrip(t, objects)
  }, 120_000)
})
