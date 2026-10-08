import { describe, expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { sorcerer } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { srdCreatures } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { dwarf, hillDwarf } from '@artificer-toolkit/source-data/srd/races/dwarf.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { sourceImportDefinitionDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { authoredPublishDraftInputSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { collectReferenceIds } from '@artificer-toolkit/shared/utils'
import { api, internal } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import {
  classDerivedArgs,
  corruptPublishedVersionPayload,
  importedSubject,
  publicationFixture
} from '../../tests/fixtures/publication'
import { readAuthoredVersionCompilation, readStoredAuthoredVersionDocument } from './documents'
import { compileCurrentEquipment } from './equipmentRelationships'
import { compileCurrentRace } from './raceRelationships'
import { compilePublicationDocument, parsePublicationDocument } from './publicationDocument'

const KINDS = [
  'BACKGROUND',
  'CLASS',
  'CREATURE',
  'EQUIPMENT',
  'FEAT',
  'RACE',
  'SPELL',
  'VEHICLE'
] as const
type Kind = (typeof KINDS)[number]

const warhorse = srdCreatures.find((creature) => creature.label === 'Warhorse')
if (!warhorse) throw new Error('Missing canonical Warhorse fixture.')

const sourceIds = {
  BACKGROUND: acolyte.id,
  CLASS: fighter.id,
  CREATURE: warhorse.id,
  EQUIPMENT: club.id,
  FEAT: grappler.id,
  RACE: dwarf.id,
  SPELL: fireball.id,
  VEHICLE: cart.id
} as const satisfies Record<Kind, string>

const classEquipmentIds = [
  '00000000-0000-0000-0060-002f00000000',
  '00000000-0000-0000-0060-002700000000',
  '00000000-0000-0000-0060-002400000000',
  '00000000-0000-0000-0060-006300000000',
  '00000000-0000-0000-0060-000b00000000',
  '00000000-0000-0000-0060-006500000000',
  '00000000-0000-0000-0060-000400000000',
  '00000000-0000-0000-0060-00b800000000',
  '00000000-0000-0000-0060-00ba00000000'
]

const referenced = [warhorse, dwarf, hillDwarf]
const spellIds = new Set(collectReferenceIds(referenced, 'spellId', 'spellIds'))
const equipmentIds = new Set([
  ...classEquipmentIds,
  club.id,
  clubPlus1.id,
  ...collectReferenceIds(referenced, 'equipmentId', 'equipmentIds')
])
const ruleIds = new Set(collectReferenceIds([warhorse], 'ruleDefinitionId', 'ruleDefinitionIds'))
const lifecycles = SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS.filter((definition) =>
  ruleIds.has(definition.id)
)
const definitionIds = new Set([
  ...ruleIds,
  ...collectReferenceIds(lifecycles, 'definitionId', 'definitionIds')
])
const definitions = SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS.filter((definition) =>
  definitionIds.has(definition.id)
)

const classes = [fighter, sorcerer, wizard]
const subjects = [
  importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte }),
  ...classes.map((item) => importedSubject({ subjectKind: 'CLASS', ...item, document: item })),
  importedSubject({ subjectKind: 'CREATURE', ...warhorse, document: warhorse }),
  ...srdEquipment
    .filter((item) => equipmentIds.has(item.id))
    .map((item) => importedSubject({ subjectKind: 'EQUIPMENT', ...item, document: item })),
  importedSubject({ subjectKind: 'FEAT', ...grappler, document: grappler }),
  importedSubject({ subjectKind: 'RACE', ...dwarf, document: dwarf }),
  importedSubject({ subjectKind: 'RACE', ...hillDwarf, document: hillDwarf }),
  ...srdSpells
    .filter((item) => spellIds.has(item.id) || item.id === fireball.id)
    .map((item) => importedSubject({ subjectKind: 'SPELL', ...item, document: item })),
  importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })
]
const batches = Array.from({ length: Math.ceil(subjects.length / 10) }, (_, index) =>
  subjects.slice(index * 10, index * 10 + 10)
)

async function fixture() {
  const setup = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    batches
  )
  if (definitions.length > 0)
    await setup.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: definitions.map((definition) =>
        sourceImportDefinitionDtoSchema.parse(definition)
      )
    })
  for (const subject of subjects.filter((item) => item.subjectKind === 'CLASS'))
    await setup.t.mutation(internal.content.import.syncClassDerived, classDerivedArgs(subject))
  for (const race of [dwarf, hillDwarf]) {
    const subject = subjects.find((item) => item.id === race.id)
    if (!subject) throw new Error('Missing Race fixture.')
    await setup.t.mutation(internal.content.raceRelationships.syncDerived, {
      id: subject.id,
      checksum: subject.checksum
    })
  }
  return setup
}

type Fixture = Awaited<ReturnType<typeof fixture>>
type Caller = Fixture['first']['caller']
type Payload = AuthoredDraftResult['payload']

function publishAs(caller: Caller, kind: Kind, draft: AuthoredDraftResult) {
  const { subjectId, expectedDraftUpdatedAt } = authoredPublishDraftInputSchema.parse({
    subjectKind: kind,
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  return kind === 'CLASS'
    ? caller.action(api.content.classPublicationActions.publishDraft, {
        subjectKind: kind,
        subjectId,
        expectedDraftUpdatedAt
      })
    : caller.mutation(api.content.publication.publishDraft, {
        subjectKind: kind,
        subjectId,
        expectedDraftUpdatedAt
      })
}

function saveDraft(
  caller: Caller,
  draft: AuthoredDraftResult,
  changes: { label?: string; payload: Payload }
) {
  return caller.mutation(api.content.drafts.save, {
    subjectKind: draft.subjectKind,
    subjectId: draft.subjectId,
    systemId: draft.systemId,
    label: changes.label ?? draft.label,
    payload: changes.payload
  })
}

function isIdentified(value: unknown) {
  return (
    typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
  )
}

/** Strips the first identified mechanic entry found down to its identity, leaving no definition. */
function withHollowedEntry(value: unknown): unknown {
  if (Array.isArray(value)) {
    const index = value.findIndex(isIdentified)
    if (index >= 0) return value.map((entry, at) => (at === index ? { id: entry.id } : entry))
    for (const [at, item] of value.entries()) {
      const changed = withHollowedEntry(item)
      if (changed !== undefined) return value.map((entry, i) => (i === at ? changed : entry))
    }
    return undefined
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      const changed = withHollowedEntry(item)
      if (changed !== undefined) return { ...value, [key]: changed }
    }
  }
  return undefined
}

function invalidMechanicPayload(kind: Kind, payload: Payload): Payload {
  if (kind === 'CREATURE') {
    const creature = creatureAuthoredDtoSchema.parse(payload)
    return {
      ...creature,
      features: creature.features?.map((feature) =>
        feature.label === 'Hooves' ? { ...feature, rollDefinitions: [] } : feature
      )
    }
  }
  const changed = withHollowedEntry(payload)
  if (typeof changed !== 'object' || changed === null || Array.isArray(changed))
    throw new Error(`No identified entry to corrupt in the ${kind} fixture.`)
  return Object.fromEntries(Object.entries(changed))
}

function storedState(t: Fixture['t']) {
  return t.run(async (ctx) => ({
    roots: await ctx.db.query('authoredRoots').collect(),
    versions: await ctx.db.query('authoredVersions').collect(),
    versionChunks: await ctx.db.query('authoredVersionPayloadChunks').collect(),
    compilations: await ctx.db.query('authoredVersionCompilations').collect(),
    drafts: await ctx.db.query('authoredDrafts').collect(),
    routes: await ctx.db.query('authoredRouteIds').collect()
  }))
}

async function expectRefused(t: Fixture['t'], attempt: Promise<unknown>, message?: string) {
  const before = await storedState(t)
  await expect(attempt).rejects.toThrow(message)
  expect(await storedState(t)).toEqual(before)
}

async function expectedCompilation(ctx: QueryCtx, kind: Kind, document: unknown, userId: string) {
  const subject = parsePublicationDocument(kind, document)
  if (subject.subjectKind === 'EQUIPMENT')
    return (await compileCurrentEquipment(ctx, subject.document, userId)).compilation
  if (subject.subjectKind === 'RACE')
    return (await compileCurrentRace(ctx, subject.document, userId)).compilation
  return compilePublicationDocument(subject)
}

function readPublished(t: Fixture['t'], kind: Kind, subjectId: string, userId: string) {
  return t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', subjectId))
      .unique()
    if (!root) throw new Error(`Missing published ${kind} root`)
    const version = await ctx.db.get(root.currentVersionId)
    if (!version) throw new Error(`Missing published ${kind} version`)
    const document = await readStoredAuthoredVersionDocument(ctx, version)
    return {
      root,
      version,
      document,
      compilation: await readAuthoredVersionCompilation(ctx, version),
      expected: await expectedCompilation(ctx, kind, document, userId),
      versionCount: (
        await ctx.db
          .query('authoredVersions')
          .withIndex('by_id_version', (q) => q.eq('id', subjectId))
          .take(5)
      ).length,
      compilationCount: (await ctx.db.query('authoredVersionCompilations').collect()).filter(
        (row) => row.subjectId === subjectId
      ).length,
      draft: await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', subjectId))
        .unique()
    }
  })
}

describe('Authored publication journeys (AUTHORING-13)', () => {
  it('validates and compiles every domain at publication, replaces document and compilation together, and recompiles Equipment and Race descendants', async () => {
    const { t, first, second } = await fixture()
    const published = new Map<Kind, { draft: AuthoredDraftResult; payload: Payload }>()

    for (const kind of KINDS) {
      const copy = await first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: kind,
        subjectId: sourceIds[kind]
      })

      await expectRefused(
        t,
        publishAs(second.caller, kind, copy),
        'Authored content cannot be published by the current user.'
      )
      await expectRefused(
        t,
        publishAs(first.caller, kind, { ...copy, subjectId: crypto.randomUUID() }),
        'Authored content cannot be published by the current user.'
      )

      const invalid = await saveDraft(first.caller, copy, {
        payload: invalidMechanicPayload(kind, copy.payload)
      })
      await expectRefused(
        t,
        publishAs(first.caller, kind, copy),
        'The draft or published content changed. Reload before publishing.'
      )
      await expectRefused(t, publishAs(first.caller, kind, invalid))
      expect(
        await first.caller.query(api.content.drafts.get, {
          subjectKind: kind,
          subjectId: copy.subjectId
        })
      ).toEqual(invalid)

      const draft = await saveDraft(first.caller, copy, { payload: copy.payload })
      const result = await publishAs(first.caller, kind, draft)
      expect(result).toMatchObject({ subjectKind: kind, subjectId: draft.subjectId })

      const stored = await readPublished(t, kind, draft.subjectId, first.userId)
      expect(stored.draft).toBeNull()
      expect(stored.document).toMatchObject({
        id: draft.subjectId,
        systemId: draft.systemId,
        userId: first.userId,
        status: 'ACTIVE'
      })
      expect(stored.root.checksum).toBe(result.checksum)
      expect(stored.version.checksum).toBe(result.checksum)
      expect(checksumRuleDocument(stored.document)).toBe(result.checksum)
      expect(stored.compilation?.authoredChecksum).toBe(result.checksum)
      expect(stored.compilation).toEqual(stored.expected)
      expect(stored.versionCount).toBe(1)
      expect(stored.compilationCount).toBe(1)

      const revised = await saveDraft(first.caller, draft, {
        label: `${draft.label} Revised`,
        payload: draft.payload
      })
      const republished = await publishAs(first.caller, kind, revised)
      expect(republished.checksum).not.toBe(result.checksum)
      const replaced = await readPublished(t, kind, draft.subjectId, first.userId)
      expect(replaced.version.version).toBe(stored.version.version + 1)
      expect(replaced.version.versionId).not.toBe(stored.version.versionId)
      expect(replaced.document).toMatchObject({ label: revised.label })
      expect(replaced.compilation?.authoredChecksum).toBe(republished.checksum)
      expect(replaced.compilation?.authoredChecksum).not.toBe(stored.compilation?.authoredChecksum)
      expect(replaced.compilation).toEqual(replaced.expected)
      expect(replaced.versionCount).toBe(1)
      expect(replaced.compilationCount).toBe(1)
      published.set(kind, { draft: revised, payload: draft.payload })
    }

    const parentEquipment = published.get('EQUIPMENT')!
    const equipmentCopy = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: clubPlus1.id
    })
    const variant = await saveDraft(first.caller, equipmentCopy, {
      payload: { ...equipmentCopy.payload, parentEquipmentId: parentEquipment.draft.subjectId }
    })
    await publishAs(first.caller, 'EQUIPMENT', variant)
    const variantBefore = await readPublished(t, 'EQUIPMENT', variant.subjectId, first.userId)
    expect(variantBefore.root.parentEquipmentId).toBe(parentEquipment.draft.subjectId)
    expect(variantBefore.compilation).toEqual(variantBefore.expected)

    const heavier = await saveDraft(first.caller, parentEquipment.draft, {
      payload: { ...parentEquipment.payload, weight: { amount: 9, unit: 'POUNDS' } }
    })
    await publishAs(first.caller, 'EQUIPMENT', heavier)
    const variantAfter = await readPublished(t, 'EQUIPMENT', variant.subjectId, first.userId)
    expect(variantAfter.version.versionId).toBe(variantBefore.version.versionId)
    expect(variantAfter.document).toEqual(variantBefore.document)
    expect(variantAfter.compilation?.projectionChecksum).not.toBe(
      variantBefore.compilation?.projectionChecksum
    )
    expect(variantAfter.compilation).toEqual(variantAfter.expected)
    expect(variantAfter.compilationCount).toBe(1)

    const parentRace = published.get('RACE')!
    const baseRace = raceAuthoredDtoSchema.parse(parentRace.payload)
    if (baseRace.category !== 'BASE') throw new Error('Expected a base Race fixture.')
    const subraceCopy = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: hillDwarf.id
    })
    const subrace = await saveDraft(first.caller, subraceCopy, {
      payload: { ...subraceCopy.payload, parentRaceId: parentRace.draft.subjectId }
    })
    await publishAs(first.caller, 'RACE', subrace)
    const subraceBefore = await readPublished(t, 'RACE', subrace.subjectId, first.userId)
    expect(subraceBefore.root.parentRaceId).toBe(parentRace.draft.subjectId)
    expect(subraceBefore.compilation).toEqual(subraceBefore.expected)

    const becomesSubrace = await saveDraft(first.caller, parentRace.draft, {
      payload: { ...subrace.payload, parentRaceId: dwarf.id }
    })
    await expectRefused(
      t,
      publishAs(first.caller, 'RACE', becomesSubrace),
      'A Race with published subraces cannot be deleted or made a subrace.'
    )

    const faster = await saveDraft(first.caller, parentRace.draft, {
      payload: {
        ...parentRace.payload,
        speeds: baseRace.speeds.map((speed, index) =>
          index === 0 ? { ...speed, amount: speed.amount + 5 } : speed
        )
      }
    })
    await publishAs(first.caller, 'RACE', faster)
    const subraceAfter = await readPublished(t, 'RACE', subrace.subjectId, first.userId)
    expect(subraceAfter.version.versionId).toBe(subraceBefore.version.versionId)
    expect(subraceAfter.document).toEqual(subraceBefore.document)
    expect(subraceAfter.compilation?.projectionChecksum).not.toBe(
      subraceBefore.compilation?.projectionChecksum
    )
    expect(subraceAfter.compilation).toEqual(subraceAfter.expected)
    expect(subraceAfter.compilationCount).toBe(1)

    const baseEquipment = equipmentAuthoredDtoSchema.parse(parentEquipment.payload)
    await t.run((ctx) => corruptPublishedVersionPayload(ctx, variant.subjectId))
    await t.run((ctx) => corruptPublishedVersionPayload(ctx, subrace.subjectId))
    const heavierStill = await saveDraft(first.caller, heavier, {
      payload: { ...baseEquipment, weight: { amount: 11, unit: 'POUNDS' } }
    })
    await expectRefused(t, publishAs(first.caller, 'EQUIPMENT', heavierStill))
    const fasterStill = await saveDraft(first.caller, faster, {
      payload: {
        ...parentRace.payload,
        speeds: baseRace.speeds.map((speed) => ({ ...speed, amount: speed.amount + 10 }))
      }
    })
    await expectRefused(t, publishAs(first.caller, 'RACE', fasterStill))
  }, 600_000)
})
