import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { sourceImportDefinitionDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import type {
  AuthoredDetailReadInput,
  AuthoredDetailReadResult
} from '@artificer-toolkit/schema/api/content'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { authoredPublishDraftInputSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import type { SystemLookupInputDto, SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { collectReferenceIds } from '@artificer-toolkit/shared/utils'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api, internal } from '../_generated/api'
import {
  classDerivedArgs,
  corruptPublishedVersionPayload,
  importedSubject,
  publicationFixture,
  versionWithCompilation
} from '../../tests/fixtures/publication'
import { readStoredAuthoredVersionDocument } from './documents'

const getDetail = makeFunctionReference<'query', AuthoredDetailReadInput, AuthoredDetailReadResult>(
  'content/details:get'
)
const getSystem = makeFunctionReference<'query', SystemLookupInputDto, SystemResponseDto>(
  'content/systems:get'
)

type Fixture = Awaited<ReturnType<typeof publicationFixture>>
type Caller = Fixture['first']['caller']
type Domain =
  | 'BACKGROUND'
  | 'CLASS'
  | 'CREATURE'
  | 'EQUIPMENT'
  | 'FEAT'
  | 'RACE'
  | 'SPELL'
  | 'VEHICLE'
type Canonical = { id: string; systemId: string; label: string }

function pick<T extends Canonical>(items: readonly T[], label: string): T {
  const found = items.find((item) => item.label === label)
  if (!found) throw new Error(`Missing canonical ${label}`)
  return found
}

const subjects = srdBaselineContent.subjects
const baseRace = subjects.races.find((race) => race.category === 'BASE')
if (!baseRace) throw new Error('Missing canonical base Race')
const fighter = pick(subjects.classes, 'Fighter')
const warhorse = pick(subjects.creatures, 'Warhorse')

const primaries: readonly { subjectKind: Domain; record: Canonical }[] = [
  { subjectKind: 'BACKGROUND', record: pick(subjects.backgrounds, 'Acolyte') },
  { subjectKind: 'CLASS', record: fighter },
  { subjectKind: 'CREATURE', record: warhorse },
  { subjectKind: 'EQUIPMENT', record: pick(subjects.equipment, 'Club') },
  { subjectKind: 'FEAT', record: pick(subjects.feats, 'Grappler') },
  { subjectKind: 'RACE', record: baseRace },
  { subjectKind: 'SPELL', record: pick(subjects.spells, 'Fireball') },
  { subjectKind: 'VEHICLE', record: pick(subjects.vehicles, 'Cart') }
]

const spellClasses = [pick(subjects.classes, 'Sorcerer'), pick(subjects.classes, 'Wizard')]
const primaryIds = new Set(primaries.map(({ record }) => record.id))
const records = primaries.map(({ record }) => record)
const referencedSpellIds = new Set(collectReferenceIds(records, 'spellId', 'spellIds'))
const referencedEquipmentIds = new Set(collectReferenceIds(records, 'equipmentId', 'equipmentIds'))
const ruleIds = new Set(collectReferenceIds([warhorse], 'ruleDefinitionId', 'ruleDefinitionIds'))
const lifecycleIds = new Set([
  ...ruleIds,
  ...collectReferenceIds(
    SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS.filter((definition) => ruleIds.has(definition.id)),
    'definitionId',
    'definitionIds'
  )
])
const definitions = SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS.filter((definition) =>
  lifecycleIds.has(definition.id)
)

const dependencySubjects = [
  ...subjects.spells
    .filter((spell) => referencedSpellIds.has(spell.id))
    .map((spell) => importedSubject({ subjectKind: 'SPELL', ...spell, document: spell })),
  ...subjects.equipment
    .filter((item) => referencedEquipmentIds.has(item.id))
    .map((item) => importedSubject({ subjectKind: 'EQUIPMENT', ...item, document: item })),
  ...spellClasses.map((item) => importedSubject({ subjectKind: 'CLASS', ...item, document: item }))
].filter((subject) => !primaryIds.has(subject.id))
const primarySubjects = primaries.map(({ subjectKind, record }) =>
  importedSubject({ subjectKind, ...record, document: record })
)
const importBatches = [...dependencySubjects, ...primarySubjects].reduce<
  (typeof primarySubjects)[]
>((batches, subject, index) => {
  if (index % 10 === 0) batches.push([])
  batches[batches.length - 1].push(subject)
  return batches
}, [])

async function fixture() {
  const setup = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    importBatches
  )
  if (definitions.length > 0)
    await setup.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: definitions.map((definition) =>
        sourceImportDefinitionDtoSchema.parse(definition)
      )
    })
  for (const subject of [...dependencySubjects, ...primarySubjects]) {
    if (subject.subjectKind === 'CLASS')
      await setup.t.mutation(internal.content.import.syncClassDerived, classDerivedArgs(subject))
  }
  const raceSubject = primarySubjects.find((subject) => subject.id === baseRace!.id)!
  await setup.t.mutation(internal.content.raceRelationships.syncDerived, {
    id: raceSubject.id,
    checksum: raceSubject.checksum
  })
  return setup
}

async function publishDraft(caller: Caller, subjectKind: Domain, draft: AuthoredDraftResult) {
  const input = authoredPublishDraftInputSchema.parse({
    subjectKind,
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  if (input.subjectKind === 'CLASS')
    return caller.action(api.content.classPublicationActions.publishDraft, {
      ...input,
      subjectKind: 'CLASS'
    })
  return caller.mutation(api.content.publication.publishDraft, {
    ...input,
    subjectKind: input.subjectKind
  })
}

function readStored(t: Fixture['t'], subjectId: string) {
  return t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', subjectId))
      .unique()
    if (!root) throw new Error(`Missing stored root ${subjectId}`)
    const current = await ctx.db.get(root.currentVersionId)
    if (!current) throw new Error(`Missing stored version ${subjectId}`)
    return {
      root,
      version: await versionWithCompilation(ctx, current),
      document: await readStoredAuthoredVersionDocument(ctx, current),
      versions: await ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', subjectId))
        .take(10),
      route: await ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', subjectId))
        .unique()
    }
  })
}

type Stored = Awaited<ReturnType<typeof readStored>>

function expectChecksumVerifies(stored: Stored) {
  expect(stored.version.checksum).toBe(stored.root.checksum)
  expect(checksumRuleDocument(stored.document)).toBe(stored.version.checksum)
}

describe('Authored identity and checksum journeys (AUTHORING-2)', () => {
  it('keeps public identity and verified checksums for System reads and all eight authored domains', async () => {
    const { t, first } = await fixture()

    const systemDocument = jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
    const storedSystem = await t.run((ctx) =>
      ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
        .unique()
    )
    const systemRead = await t.query(getSystem, { id: srdSystemRecord.id.toUpperCase() })
    expect(systemRead).toEqual(systemDocument)
    expect(checksumRuleDocument(jsonValueSchema.parse(systemRead))).toBe(storedSystem?.checksum)
    expect(storedSystem?.checksum).toBe(checksumRuleDocument(systemDocument))

    const owned = new Map<Domain, string>()
    for (const { subjectKind, record } of primaries) {
      const canonicalDocument = jsonValueSchema.parse(JSON.parse(JSON.stringify(record)))
      const canonicalImport = primarySubjects.find((subject) => subject.id === record.id)!

      const canonicalDetail = await t.query(getDetail, {
        subjectKind,
        id: record.id.toUpperCase()
      })
      expect(canonicalDetail?.item).toEqual(canonicalDocument)
      const canonical = await readStored(t, record.id)
      expect(canonical.document).toEqual(canonicalDocument)
      expect(canonical.version.checksum).toBe(canonicalImport.checksum)
      expectChecksumVerifies(canonical)
      expect(await t.query(getDetail, { subjectKind, id: canonicalDetail!.publicId })).toEqual(
        canonicalDetail
      )
      const expectCanonicalUnchanged = async () => {
        expect(await readStored(t, record.id)).toEqual(canonical)
        expect(await t.query(getDetail, { subjectKind, id: record.id })).toEqual(canonicalDetail)
      }

      const copy = await first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind,
        subjectId: record.id
      })
      expect(copy.subjectId).not.toBe(record.id)
      expect(copy.publicId).not.toBe(canonicalDetail!.publicId)
      expect(copy.userId).toBe(first.userId)
      await expectCanonicalUnchanged()

      const publication = await publishDraft(first.caller, subjectKind, copy)
      expect(publication).toMatchObject({
        subjectKind,
        subjectId: copy.subjectId,
        publicId: copy.publicId
      })
      const published = await readStored(t, copy.subjectId)
      expect(published.version.checksum).toBe(publication.checksum)
      expect(published.route?.publicId).toBe(copy.publicId)
      expectChecksumVerifies(published)
      const publishedDetail = await first.caller.query(getDetail, {
        subjectKind,
        id: copy.subjectId
      })
      expect(publishedDetail?.publicId).toBe(copy.publicId)
      expect(publishedDetail?.item).toEqual(published.document)
      expect(
        await first.caller.query(getDetail, { subjectKind, id: copy.publicId })
      ).toEqual(publishedDetail)
      await expectCanonicalUnchanged()

      const edit = await first.caller.mutation(api.content.drafts.save, {
        subjectKind,
        subjectId: copy.subjectId,
        systemId: copy.systemId,
        label: `${record.label} Revised`,
        payload: copy.payload
      })
      expect(edit.publicId).toBe(copy.publicId)
      const replacement = await publishDraft(first.caller, subjectKind, edit)
      expect(replacement.publicId).toBe(copy.publicId)
      expect(replacement.checksum).not.toBe(publication.checksum)
      const replaced = await readStored(t, copy.subjectId)
      expect(replaced.version.checksum).toBe(replacement.checksum)
      expect(replaced.version.version).toBe(published.version.version + 1)
      expect(replaced.versions).toHaveLength(1)
      expect(replaced.route).toEqual(published.route)
      expect(replaced.document.label).toBe(`${record.label} Revised`)
      expectChecksumVerifies(replaced)
      const replacedDetail = await first.caller.query(getDetail, {
        subjectKind,
        id: copy.subjectId
      })
      expect(replacedDetail?.publicId).toBe(copy.publicId)
      expect(replacedDetail?.item).toEqual(replaced.document)
      await expectCanonicalUnchanged()

      const staleToken = await first.caller.mutation(api.content.drafts.save, {
        subjectKind,
        subjectId: copy.subjectId,
        systemId: copy.systemId,
        label: `${record.label} Rejected`,
        payload: copy.payload
      })
      const current = await first.caller.mutation(api.content.drafts.save, {
        subjectKind,
        subjectId: copy.subjectId,
        systemId: copy.systemId,
        label: `${record.label} Rejected`,
        payload: copy.payload
      })
      expect(current.updatedAt).not.toBe(staleToken.updatedAt)
      await expect(publishDraft(first.caller, subjectKind, staleToken)).rejects.toThrow(
        'draft or published content changed'
      )
      expect(await readStored(t, copy.subjectId)).toEqual(replaced)
      const afterRejection = await first.caller.query(getDetail, {
        subjectKind,
        id: copy.subjectId
      })
      expect(afterRejection).toMatchObject({
        hasDraft: true,
        publicId: replacedDetail?.publicId,
        activeUpdatedAt: replacedDetail?.activeUpdatedAt
      })
      expect(afterRejection?.item).toEqual(replacedDetail?.item)
      expect(
        await first.caller.query(api.content.drafts.get, {
          subjectKind,
          subjectId: copy.subjectId
        })
      ).toEqual(current)
      await expectCanonicalUnchanged()
      owned.set(subjectKind, copy.subjectId)
    }

    const backgroundId = owned.get('BACKGROUND')!
    const invalid = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: backgroundId,
      systemId: srdSystemRecord.id,
      label: 'Invalid revision',
      payload: { details: [null] }
    })
    const beforeInvalid = await readStored(t, backgroundId)
    await expect(publishDraft(first.caller, 'BACKGROUND', invalid)).rejects.toThrow()
    expect(await readStored(t, backgroundId)).toEqual(beforeInvalid)

    const featId = owned.get('FEAT')!
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', featId))
        .unique()
      await ctx.db.patch(root!._id, { checksum: '0'.repeat(64) })
    })
    await expect(
      first.caller.query(getDetail, { subjectKind: 'FEAT', id: featId })
    ).rejects.toThrow('identity mismatch')

    await t.run((ctx) => corruptPublishedVersionPayload(ctx, backgroundId))
    await expect(
      first.caller.query(getDetail, { subjectKind: 'BACKGROUND', id: backgroundId })
    ).rejects.toThrow('checksum mismatch')
  }, 180000)
})
