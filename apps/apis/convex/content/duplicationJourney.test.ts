import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  sourceImportDefinitionDtoSchema,
  type SourceImportSubjectDto
} from '@artificer-toolkit/schema/api/sourceImport'
import type {
  AuthoredDetailReadInput,
  AuthoredDetailReadResult
} from '@artificer-toolkit/schema/api/content'
import { authoredPublishDraftInputSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { api, internal } from '../_generated/api'
import {
  classDerivedArgs,
  importedSubject,
  publicationFixture
} from '../../tests/fixtures/publication'

type SubjectKind = SourceImportSubjectDto['subjectKind']
type SubjectSeed = { id: string; systemId: string; label: string }
type Candidate = { subjectKind: SubjectKind; seed: SubjectSeed }

const getDetail = makeFunctionReference<'query', AuthoredDetailReadInput, AuthoredDetailReadResult>(
  'content/details:get'
)
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

const groups: ReadonlyArray<readonly [SubjectKind, readonly SubjectSeed[]]> = [
  ['BACKGROUND', srdBaselineContent.subjects.backgrounds],
  ['CLASS', srdBaselineContent.subjects.classes],
  ['CREATURE', srdBaselineContent.subjects.creatures],
  ['EQUIPMENT', srdBaselineContent.subjects.equipment],
  ['FEAT', srdBaselineContent.subjects.feats],
  ['RACE', srdBaselineContent.subjects.races],
  ['SPELL', srdBaselineContent.subjects.spells],
  ['VEHICLE', srdBaselineContent.subjects.vehicles]
]
const candidatesById = new Map<string, Candidate>(
  groups.flatMap(([subjectKind, seeds]) =>
    seeds.map((seed): [string, Candidate] => [seed.id, { subjectKind, seed }])
  )
)
const definitionsById = new Map(
  SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS.map((definition) => [definition.id, definition])
)

function shape(value: unknown): { depth: number; idNodes: number } {
  if (Array.isArray(value)) {
    return value.reduce<{ depth: number; idNodes: number }>(
      (total, item) => {
        const inner = shape(item)
        return {
          depth: Math.max(total.depth, inner.depth + 1),
          idNodes: total.idNodes + inner.idNodes
        }
      },
      { depth: 0, idNodes: 0 }
    )
  }
  if (typeof value !== 'object' || value === null) return { depth: 0, idNodes: 0 }
  return Object.entries(value).reduce<{ depth: number; idNodes: number }>(
    (total, [key, entry]) => {
      const inner = shape(entry)
      return {
        depth: Math.max(total.depth, inner.depth + 1),
        idNodes: total.idNodes + inner.idNodes + (key === 'id' && typeof entry === 'string' ? 1 : 0)
      }
    },
    { depth: 0, idNodes: 0 }
  )
}

function deepest([subjectKind, seeds]: (typeof groups)[number]): Candidate {
  const [first, ...rest] = seeds.map((seed): Candidate & { depth: number; idNodes: number } => ({
    subjectKind,
    seed,
    ...shape(seed)
  }))
  if (!first) throw new Error(`No canonical ${subjectKind} records.`)
  return rest.reduce(
    (best, next) =>
      next.depth > best.depth || (next.depth === best.depth && next.idNodes > best.idNodes)
        ? next
        : best,
    first
  )
}

function uuidStrings(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (UUID.test(value)) found.add(value)
  } else if (Array.isArray(value)) value.forEach((item) => uuidStrings(item, found))
  else if (typeof value === 'object' && value !== null)
    Object.values(value).forEach((item) => uuidStrings(item, found))
  return found
}

/** Every canonical record the chosen records transitively reference, so they can publish. */
function dependencyClosure(roots: readonly Candidate[]) {
  const subjects = new Map(roots.map((root) => [root.seed.id, root]))
  const definitions = new Map<string, (typeof SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS)[number]>()
  const queue: unknown[] = roots.map((root) => root.seed)
  for (let value = queue.pop(); value !== undefined; value = queue.pop()) {
    for (const id of uuidStrings(value)) {
      const subject = candidatesById.get(id)
      if (subject && !subjects.has(id)) {
        subjects.set(id, subject)
        queue.push(subject.seed)
      }
      const definition = definitionsById.get(id)
      if (definition && !definitions.has(id)) {
        definitions.set(id, definition)
        queue.push(definition)
      }
    }
  }
  return { subjects: [...subjects.values()], definitions: [...definitions.values()] }
}

function chunk<T>(items: readonly T[], size = 10): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  )
}

type Leaf = { path: string; key: string | undefined; source: string; copy: string }

/** Walks source and copy in parallel, requiring identical structure, and returns string leaves. */
function pairStrings(source: unknown, copy: unknown, path = '', key?: string): Leaf[] {
  expect(typeof copy, path).toBe(typeof source)
  expect(Array.isArray(copy), path).toBe(Array.isArray(source))
  if (typeof source === 'string' && typeof copy === 'string') return [{ path, key, source, copy }]
  if (Array.isArray(source) && Array.isArray(copy)) {
    expect(copy.length, path).toBe(source.length)
    return source.flatMap((item, index) => pairStrings(item, copy[index], `${path}[${index}]`, key))
  }
  if (typeof source !== 'object' || source === null || typeof copy !== 'object' || copy === null)
    return []
  expect(Object.keys(copy).sort(), path).toEqual(Object.keys(source).sort())
  return Object.entries(source).flatMap(([entryKey, entry]) =>
    pairStrings(entry, (copy as Record<string, unknown>)[entryKey], `${path}.${entryKey}`, entryKey)
  )
}

function assertFreshClone(source: unknown, copy: unknown) {
  const leaves = pairStrings(source, copy)
  const forward = new Map<string, string>()
  const reverse = new Map<string, string>()
  const idLeaves = leaves.filter((leaf) => leaf.key === 'id')
  for (const leaf of idLeaves) {
    expect(leaf.copy, `${leaf.path} must be a fresh id`).not.toBe(leaf.source)
    expect(leaf.copy, `${leaf.path} must be a UUID`).toMatch(UUID)
    expect(forward.get(leaf.source) ?? leaf.copy, `${leaf.path} maps inconsistently`).toBe(
      leaf.copy
    )
    expect(reverse.get(leaf.copy) ?? leaf.source, `${leaf.path} collides`).toBe(leaf.source)
    forward.set(leaf.source, leaf.copy)
    reverse.set(leaf.copy, leaf.source)
  }
  const references = leaves.filter((leaf) => leaf.key !== 'id' && UUID.test(leaf.source))
  for (const leaf of references)
    expect(leaf.copy, `${leaf.path} must be remapped or preserved`).toBe(
      forward.get(leaf.source) ?? leaf.source
    )
  const copyUuids = uuidStrings(copy)
  for (const sourceId of forward.keys())
    expect(copyUuids.has(sourceId), `source id ${sourceId} survived in the copy`).toBe(false)
  return {
    mapping: forward,
    idNodes: idLeaves.length,
    remappedReferences: references.filter((leaf) => forward.has(leaf.source)).length,
    preservedReferences: references.filter((leaf) => !forward.has(leaf.source)).length
  }
}

describe('Authored duplication journeys (AUTHORING-14)', () => {
  it('duplicates the deepest canonical record of every domain with fresh remapped ids, publishes it, and duplicates the copy again', async () => {
    const chosen = groups.map(deepest)
    const closure = dependencyClosure(chosen)
    const isDerivedChild = (subject: SourceImportSubjectDto) =>
      subject.subjectKind === 'CLASS'
        ? classDerivedArgs(subject).parentClassId !== null
        : subject.subjectKind === 'RACE' &&
          raceAuthoredDtoSchema.parse(subject.document).category === 'SUBRACE'
    const imported = closure.subjects.map(({ subjectKind, seed }) =>
      importedSubject({ subjectKind, ...seed, document: seed })
    )
    // Subclasses and Subraces require their base to be readable when they are imported.
    const dtos = [
      ...imported.filter((subject) => !isDerivedChild(subject)),
      ...imported.filter(isDerivedChild)
    ]
    const { t, first } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      chunk(dtos)
    )
    const classDerived = dtos
      .filter((subject) => subject.subjectKind === 'CLASS')
      .map(classDerivedArgs)
    for (const derived of [
      ...classDerived.filter((entry) => entry.parentClassId === null),
      ...classDerived.filter((entry) => entry.parentClassId !== null)
    ])
      await t.mutation(internal.content.import.syncClassDerived, derived)
    for (const category of ['BASE', 'SUBRACE'])
      for (const subject of dtos)
        if (
          subject.subjectKind === 'RACE' &&
          raceAuthoredDtoSchema.parse(subject.document).category === category
        )
          await t.mutation(internal.content.raceRelationships.syncDerived, {
            id: subject.id,
            checksum: subject.checksum
          })
    for (const subject of dtos)
      if (subject.subjectKind === 'EQUIPMENT')
        await t.mutation(internal.content.import.syncEquipmentDerived, {
          id: subject.id,
          checksum: subject.checksum
        })
    for (const definitions of chunk(closure.definitions))
      await t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions: definitions.map((definition) =>
          sourceImportDefinitionDtoSchema.parse(definition)
        )
      })

    const readRoot = (subjectId: string) =>
      t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', subjectId))
          .unique()
        if (!root) throw new Error(`Missing authored root ${subjectId}`)
        return { checksum: root.checksum, currentVersionId: root.currentVersionId }
      })
    const readItem = async (subjectKind: SubjectKind, id: string) => {
      const detail = await first.caller.query(getDetail, { subjectKind, id })
      if (!detail) throw new Error(`Missing ${subjectKind} detail ${id}`)
      return detail.item
    }

    const checked: Array<{ subjectKind: SubjectKind; ids: number; references: number }> = []
    for (const { subjectKind, seed } of chosen) {
      const sourceItem = await readItem(subjectKind, seed.id)
      const sourceRoot = await readRoot(seed.id)

      const copy = await first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind,
        subjectId: seed.id
      })
      expect(copy.subjectId, subjectKind).not.toBe(seed.id)
      expect(copy.userId, subjectKind).toBe(first.userId)
      const { payload } = copy
      expect(payload.id).toBe(copy.subjectId)
      expect(payload.userId).toBe(first.userId)
      const firstClone = assertFreshClone(
        {
          ...sourceItem,
          kind: payload.kind,
          label: payload.label,
          userId: payload.userId,
          status: payload.status
        },
        payload
      )
      expect(firstClone.mapping.get(seed.id), subjectKind).toBe(copy.subjectId)
      expect(firstClone.idNodes, subjectKind).toBeGreaterThan(0)
      expect(await readItem(subjectKind, seed.id), subjectKind).toEqual(sourceItem)
      expect(await readRoot(seed.id), subjectKind).toEqual(sourceRoot)

      const publication = authoredPublishDraftInputSchema.parse({
        subjectKind,
        subjectId: copy.subjectId,
        expectedDraftUpdatedAt: copy.updatedAt
      })
      if (publication.subjectKind === 'CLASS')
        await first.caller.action(api.content.classPublicationActions.publishDraft, {
          ...publication,
          subjectKind: 'CLASS'
        })
      else
        await first.caller.mutation(api.content.publication.publishDraft, {
          ...publication,
          subjectKind: publication.subjectKind
        })

      const publishedItem = await readItem(subjectKind, copy.subjectId)
      expect(uuidStrings(publishedItem), subjectKind).toEqual(uuidStrings(payload))
      const publishedRoot = await readRoot(copy.subjectId)

      const second = await first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind,
        subjectId: copy.subjectId
      })
      expect(second.subjectId, subjectKind).not.toBe(copy.subjectId)
      expect(second.subjectId, subjectKind).not.toBe(seed.id)
      expect(second.userId, subjectKind).toBe(first.userId)
      const secondPayload = second.payload
      const secondClone = assertFreshClone(
        {
          ...publishedItem,
          kind: secondPayload.kind,
          label: secondPayload.label,
          userId: secondPayload.userId,
          status: secondPayload.status
        },
        secondPayload
      )
      expect(secondClone.mapping.get(copy.subjectId), subjectKind).toBe(second.subjectId)
      const earlierIds = new Set([...firstClone.mapping.keys(), ...firstClone.mapping.values()])
      for (const freshId of secondClone.mapping.values())
        expect(earlierIds.has(freshId), `${subjectKind} reused ${freshId}`).toBe(false)
      expect(await readItem(subjectKind, copy.subjectId), subjectKind).toEqual(publishedItem)
      expect(await readRoot(copy.subjectId), subjectKind).toEqual(publishedRoot)
      expect(await readItem(subjectKind, seed.id), subjectKind).toEqual(sourceItem)

      checked.push({
        subjectKind,
        ids: firstClone.idNodes + secondClone.idNodes,
        references:
          firstClone.remappedReferences +
          firstClone.preservedReferences +
          secondClone.remappedReferences +
          secondClone.preservedReferences
      })
    }
    expect(checked.map((entry) => entry.subjectKind)).toEqual(groups.map(([kind]) => kind))
    for (const entry of checked) {
      expect(entry.ids, entry.subjectKind).toBeGreaterThan(0)
      expect(entry.references, entry.subjectKind).toBeGreaterThan(0)
    }
  }, 600000)
})
