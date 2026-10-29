import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { AUTHORED_SOURCE_FACTS_VERSION } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import type {
  NodeRuntimeResolveRequestDto,
  NodeRuntimeNormalizeValuesResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  expandNodeRuntimeResponse,
  type NodeRuntimeCompactResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { sourceImportDefinitionDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE,
  SRD_REUSABLE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { importSeededSubjects } from '../../tests/fixtures/publication'
import { api, components, internal } from '../_generated/api'
import schema from '../schema'
import authSchema from '../betterAuth/schema'
import { createSystemSourceReader } from './systemSources'
import {
  readCurrentSourceDefinitions,
  readDefinitionRoot,
  readSystemOwner
} from '../content/definitionStore'
import { readAuthoringSources } from '../content/sources'
import { authoredSourceFacts, resolveNodeRuntime } from '@artificer-toolkit/authoring/nodeRuntime'
import { getValueAtPath, isRuntimeRecord } from '@artificer-toolkit/shared/utils'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const resolve = makeFunctionReference<
  'query',
  NodeRuntimeResolveRequestDto,
  NodeRuntimeCompactResolveResponseDto
>('authoring/nodeRuntime:resolve')
const normalize = makeFunctionReference<
  'query',
  NodeRuntimeResolveRequestDto,
  NodeRuntimeNormalizeValuesResponseDto
>('authoring/nodeRuntime:normalizeValues')
const system = jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
const definition = sourceImportDefinitionDtoSchema.parse(SRD_REUSABLE_DEFINITIONS[0])
const skillInput = {
  mapId: 'proficiencyGrant',
  systemId: srdSystemRecord.id,
  values: {
    proficiencyKind: 'SKILL',
    selectionKind: 'GRANTED',
    authoringModeKind: 'SELECTED',
    level: 'FULL'
  }
}

async function fixture() {
  const t = convexTest(schema, modules)
  t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))
  await t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: srdSystemRecord.id,
        document: system,
        checksum: checksumRuleDocument(system)
      }
    ],
    contentSource: SRD_CONTENT_SOURCE,
    catalogue: SRD_RULES_CATALOGUE
  })
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Author',
          email: 'resolver@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: 'resolver-session',
          expiresAt: Date.now() + 60000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const profile = await t.run((ctx) =>
    ctx.db
      .query('userProfiles')
      .withIndex('by_authUserId', (q) => q.eq('authUserId', user._id))
      .unique()
  )
  if (!profile) throw new Error('Missing authenticated profile fixture')
  return {
    t,
    userId: profile.userId,
    caller: t.withIdentity({ subject: user._id, sessionId: session._id })
  }
}

const equipmentIds = [
  '00000000-0000-0000-0060-006000000000',
  '00000000-0000-0000-0060-00a500000000',
  '00000000-0000-0000-0060-016b00000000',
  '00000000-0000-0000-0060-016900000000',
  '00000000-0000-0000-0060-016a00000000',
  '00000000-0000-0000-0060-008300000000',
  '00000000-0000-0000-0060-009700000000'
] as const

function importedSubject(subject: { id: string; label: string; systemId: string }) {
  const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(subject)))
  return {
    subjectKind: 'EQUIPMENT' as const,
    id: subject.id,
    systemId: subject.systemId,
    label: subject.label,
    checksum: checksumRuleDocument(document),
    document
  }
}

async function importAcolyteEquipment(t: Awaited<ReturnType<typeof fixture>>['t']) {
  const equipment = srdBaselineContent.subjects.equipment.filter((item) =>
    equipmentIds.includes(item.id as (typeof equipmentIds)[number])
  )
  const mace = srdBaselineContent.subjects.equipment.find((item) => item.label === 'Mace')
  const plate = srdBaselineContent.subjects.equipment.find((item) => item.label === 'Plate Armor')
  if (!mace || !plate || equipment.length !== equipmentIds.length) {
    throw new Error('Missing canonical Acolyte equipment fixtures')
  }
  await importSeededSubjects(t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      {
        subjectKind: 'BACKGROUND' as const,
        id: acolyte.id,
        systemId: acolyte.systemId,
        label: acolyte.label,
        checksum: checksumRuleDocument(acolyte),
        document: jsonValueSchema.parse(JSON.parse(JSON.stringify(acolyte)))
      },
      ...equipment.map(importedSubject),
      importedSubject(mace),
      importedSubject(plate)
    ]
  })
  return { mace, plate }
}

describe('native Convex authoring resolver', () => {
  it('compacts the complete canonical Fighter model without losing resolved semantics', async () => {
    const { t, caller, userId } = await fixture()
    // Every SRD equipment item and class, so option lists are as large as on a seeded deployment.
    const { equipment, classes } = srdBaselineContent.subjects
    const subjects = [
      ...equipment.map(importedSubject),
      ...classes.map((subject) => ({ ...importedSubject(subject), subjectKind: 'CLASS' as const }))
    ]
    for (let index = 0; index < subjects.length; index += 10)
      await importSeededSubjects(t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: subjects.slice(index, index + 10)
      })
    const fighter = classes.find((subject) => subject.label === 'Fighter')
    if (!fighter) throw new Error('Missing canonical Fighter fixture')
    const request = {
      mapId: 'class',
      systemId: srdSystemRecord.id,
      values: JSON.parse(JSON.stringify(fighter))
    } satisfies NodeRuntimeResolveRequestDto

    const compact = await caller.query(resolve, request)
    let readerCalls = 0
    const { original, perScope } = await t.run(async (ctx) => {
      const reader = await createSystemSourceReader(ctx, request.systemId, userId)
      const counted: typeof reader = (...query) => {
        readerCalls += 1
        return reader(...query)
      }
      const original = await resolveNodeRuntime(counted, request)
      // Each scope resolved on its own, with nothing shared with the other scopes, must equal the
      // model the shared resolution gave it. A scope's parent is its nearest enclosing scope.
      const scopeValues = (path: readonly (string | number)[]) => {
        const values = getValueAtPath(request.values, path)
        if (!isRuntimeRecord(values)) throw new Error('A resolved scope must have record values.')
        return values
      }
      const perScope: Pick<typeof original, 'mapId' | 'steps' | 'clearPaths'>[] = []
      for (const scope of original.scopes) {
        const enclosing = original.scopes
          .filter(
            (other) =>
              other.path.length < scope.path.length &&
              other.path.every((segment, index) => scope.path[index] === segment)
          )
          .sort((left, right) => right.path.length - left.path.length)
        const lineage = [...enclosing.map((other) => scopeValues(other.path)), request.values]
        const alone = await resolveNodeRuntime(reader, {
          mapId: scope.mapId,
          systemId: request.systemId,
          values: scopeValues(scope.path),
          parentValues: lineage[0],
          ancestors: lineage
        })
        perScope.push({ mapId: alone.mapId, steps: alone.steps, clearPaths: alone.clearPaths })
      }
      return { original, perScope }
    })

    // RELIABILITY-21.T19: re-resolving 1,283 scopes that share 62 models cost ~335 reader calls and
    // ~30,000 resolved nodes, which ran past resolve's 1 s budget on CI. Equal scopes resolve once.
    expect(readerCalls).toBeLessThan(60)
    expect(perScope).toEqual(
      original.scopes.map(({ mapId, steps, clearPaths }) => ({ mapId, steps, clearPaths }))
    )
    expect(compact.scopes.length).toBeGreaterThan(1000)
    expect(compact.models.length).toBeLessThan(compact.scopes.length / 10)
    expect(new TextEncoder().encode(JSON.stringify(compact)).byteLength).toBeLessThan(1_000_000)
    // RELIABILITY-21.T1: validating and serializing the response dominated resolve's 1 s budget
    // (756 KB before nodes were interned).
    expect(new TextEncoder().encode(JSON.stringify(compact)).byteLength).toBeLessThan(500_000)
    expect(expandNodeRuntimeResponse(compact)).toEqual(JSON.parse(JSON.stringify(original)))
  })

  it('requires current authentication and rejects identity or source injection', async () => {
    const { t, caller } = await fixture()
    await expect(t.query(resolve, skillInput)).rejects.toThrow()
    await expect(t.query(normalize, skillInput)).rejects.toThrow()
    const spoofedIdentity = { ...skillInput, userId: 'someone-else' }
    const spoofedSource = { ...skillInput, table: 'userProfiles' }
    await expect(caller.query(resolve, spoofedIdentity)).rejects.toThrow()
    await expect(caller.query(resolve, spoofedSource)).rejects.toThrow()
    await expect(
      caller.query(resolve, { ...skillInput, mapId: 'not-a-shipped-map' })
    ).rejects.toThrow()
    await expect(caller.query(resolve, { ...skillInput, systemId: 'not-a-uuid' })).rejects.toThrow()
    await expect(
      caller.query(resolve, {
        ...skillInput,
        systemId: '10000000-0000-4000-8000-000000000099'
      })
    ).rejects.toThrow('System not found')
    await expect(
      caller.query(normalize, {
        ...skillInput,
        values: { ...skillInput.values, skillIds: Array(501).fill('invalid') }
      })
    ).rejects.toThrow('arrays may contain at most')
  })

  it('resolves exact canonical skill UUIDs and labels through the shared map', async () => {
    const { caller } = await fixture()
    const result = expandNodeRuntimeResponse(await caller.query(resolve, skillInput))
    const nodes = result.steps.flatMap((step) => step.sections.flatMap((section) => section.nodes))
    const skill = nodes.find((node) => node.id === 'skillIds')
    expect(skill).toMatchObject({
      visible: true,
      required: true,
      path: ['skillIds']
    })
    if (!skill || !('options' in skill)) throw new Error('Expected a skill select')
    expect(skill.options).toEqual(
      srdSystemRecord.skills.map((item) => ({
        value: item.id,
        label: item.label,
        ...(item.description ? { description: item.description } : {})
      }))
    )
    expect(JSON.stringify(result)).not.toMatch(/"(_id|_creationTime|document|checksum)"/)
  })

  it('normalizes prospective values without mutating source data or the caller input', async () => {
    const { t, caller } = await fixture()
    const input = {
      ...skillInput,
      values: {
        ...skillInput.values,
        skillIds: [srdSystemRecord.skills[0].id, 'invalid-skill'],
        count: 9
      }
    }
    const before = structuredClone(input)
    const storedBefore = await t.run((ctx) =>
      ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
        .unique()
    )
    const result = await caller.query(normalize, input)
    expect(result.values).toMatchObject({
      ...skillInput.values,
      skillIds: [srdSystemRecord.skills[0].id]
    })
    // This existing map retains hidden count; only explicit CLEAR fields may be removed.
    expect(result.values).toHaveProperty('count', 9)
    const cleared = await caller.query(normalize, {
      mapId: 'facetCondition',
      systemId: srdSystemRecord.id,
      values: {
        kind: 'PREDICATE',
        constraint: 'INCLUDE',
        predicateCode: 'SPELLCASTING',
        relationCode: 'FEATURE',
        featureIds: ['stale-feature'],
        authoringModeKind: 'ALL'
      },
      parentValues: { subject: 'CHARACTER' }
    })
    expect(cleared.values).toEqual({
      kind: 'PREDICATE',
      constraint: 'INCLUDE'
    })
    expect(cleared.clearedPaths).toContainEqual(['featureIds'])
    expect(input).toEqual(before)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('systems')
          .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
          .unique()
      )
    ).toEqual(storedBefore)
  })

  it('resolves and normalizes canonical Acolyte equipment without losing nested UUIDs', async () => {
    const { t, caller } = await fixture()
    await importAcolyteEquipment(t)
    const values = { ...structuredClone(acolyte) }
    const result = expandNodeRuntimeResponse(
      await caller.query(resolve, {
        mapId: 'background',
        systemId: srdSystemRecord.id,
        values
      })
    )
    const equipmentNodes = result.scopes
      .filter((scope) => scope.mapId === 'startingEquipmentItem')
      .flatMap((scope) => scope.steps)
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
      .filter((node) => node.id === 'equipmentIds')
    expect(equipmentNodes.length).toBeGreaterThan(0)
    const optionIds = equipmentNodes.flatMap((node) =>
      'options' in node ? node.options.map((option) => option.value) : []
    )
    for (const id of equipmentIds) expect(optionIds).toContain(id)
    const normalized = await caller.query(normalize, {
      mapId: 'background',
      systemId: srdSystemRecord.id,
      values
    })
    expect(normalized.values).toHaveProperty('startingEquipment', values.startingEquipment)
  })

  it('keeps nested Background proficiency resolution in the same absolute-path response', async () => {
    const { caller } = await fixture()
    const result = expandNodeRuntimeResponse(
      await caller.query(resolve, {
        mapId: 'background',
        systemId: srdSystemRecord.id,
        values: {
          label: 'Background under construction',
          proficiencies: [skillInput.values]
        }
      })
    )
    const scope = result.scopes.find((item) => item.mapId === 'proficiencyGrant')
    expect(scope).toMatchObject({ path: ['proficiencies', 0] })
    expect(
      scope?.steps.flatMap((step) => step.sections.flatMap((section) => section.nodes))
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'skillIds', visible: true })]))
  })

  it('reads canonical Creature choices from compact source facts', async () => {
    const { t, userId } = await fixture()
    const creature = srdBaselineContent.subjects.creatures[0]
    const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(creature)))
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        {
          subjectKind: 'CREATURE',
          id: creature.id,
          systemId: creature.systemId,
          label: creature.label,
          checksum: checksumRuleDocument(document),
          document
        }
      ]
    })
    const rows = await t.run((ctx) =>
      createSystemSourceReader(ctx, srdSystemRecord.id, userId).then((reader) =>
        reader('creatures', ['id', 'label'], undefined, srdSystemRecord.id)
      )
    )
    expect(rows).toEqual([{ id: creature.id, label: creature.label }])
  })

  it('filters equipment options by canonical category and properties', async () => {
    const { t, caller } = await fixture()
    const { mace, plate } = await importAcolyteEquipment(t)
    const request = {
      mapId: 'startingEquipmentItem',
      systemId: srdSystemRecord.id,
      values: {
        startingEquipmentKind: 'EQUIPMENT',
        authoringModeKind: 'SELECTED',
        category: 'WEAPON',
        properties: ['SIMPLE'],
        equipmentIds: [mace.id, plate.id]
      }
    }
    const result = expandNodeRuntimeResponse(await caller.query(resolve, request))
    const node = result.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
      .find((item) => item.id === 'equipmentIds')
    if (!node || !('options' in node)) throw new Error('Expected equipment options')
    expect(node.options).toEqual([{ value: mace.id, label: mace.label }])
    const normalized = await caller.query(normalize, request)
    expect(normalized.values).toHaveProperty('equipmentIds', [mace.id])
  })

  it('serves guided equipment choices from the same trusted source without legacy metadata', async () => {
    const { t, caller, userId } = await fixture()
    const { mace } = await importAcolyteEquipment(t)
    const args = { systemId: srdSystemRecord.id.toUpperCase() }
    await expect(t.query(api.content.equipmentOptions.list, args)).rejects.toThrow(
      /Unauthenticated/
    )
    const result = await caller.query(api.content.equipmentOptions.list, args)
    const rows = await t.run(async (ctx) => {
      const reader = await createSystemSourceReader(ctx, srdSystemRecord.id, userId)
      return reader('equipment', ['id', 'label'], undefined, srdSystemRecord.id)
    })
    expect(result).toEqual(rows.map(({ id, label }) => ({ value: id, label })))
    expect(result).toHaveLength(9)
    expect(result).toContainEqual({ value: mace.id, label: mace.label })
    expect(JSON.stringify(result)).not.toMatch(
      /"(_id|_creationTime|document|checksum|ownerUserId)"/
    )
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', mace.id))
        .unique()
      if (!root) throw new Error('Missing canonical equipment fixture')
      await ctx.db.patch(root._id, { equipmentOptions: undefined })
    })
    await expect(caller.query(api.content.equipmentOptions.list, args)).rejects.toThrow(
      /not materialized/
    )
  })

  it('can exclude variants from Guided base-item choices without changing other option readers', async () => {
    const { t, caller } = await fixture()
    const { mace } = await importAcolyteEquipment(t)
    const variant = equipmentAuthoredDtoSchema.parse({
      ...mace,
      id: crypto.randomUUID(),
      label: 'Guided option variant',
      category: 'VARIANT',
      parentEquipmentId: mace.id
    })
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject(variant)]
    })
    const args = { systemId: srdSystemRecord.id }
    const all = await caller.query(api.content.equipmentOptions.list, args)
    expect(all).toContainEqual({ value: variant.id, label: variant.label })
    expect(
      await caller.query(api.content.equipmentOptions.list, { ...args, excludeVariants: false })
    ).toEqual(all)
    const bases = await caller.query(api.content.equipmentOptions.list, {
      ...args,
      excludeVariants: true
    })
    expect(bases).toEqual(all.filter((item) => item.value !== variant.id))
    expect(bases).toContainEqual({ value: mace.id, label: mace.label })
  })

  it('resolves and normalizes nested Background spell and class selections through native sources', async () => {
    const { t, caller } = await fixture()
    const spell = srdBaselineContent.subjects.spells[0]
    const characterClass = srdBaselineContent.subjects.classes[0]
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [spell, characterClass].map((item) => {
        const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(item)))
        return {
          subjectKind: item === spell ? ('SPELL' as const) : ('CLASS' as const),
          id: item.id,
          systemId: item.systemId,
          label: item.label,
          checksum: checksumRuleDocument(document),
          document
        }
      })
    })
    const request = {
      mapId: 'background',
      systemId: srdSystemRecord.id,
      values: {
        features: [
          {
            id: crypto.randomUUID(),
            label: 'Spell training',
            description: '',
            order: 0,
            grants: {
              spells: [
                {
                  grantKind: 'SPELL_GRANT',
                  id: crypto.randomUUID(),
                  order: 0,
                  selectionKind: 'GRANTED',
                  scalingKind: 'PER_LEVEL',
                  progression: {
                    scalingSource: 'CLASS_LEVEL',
                    classId: characterClass.id,
                    levels: [
                      {
                        id: crypto.randomUUID(),
                        level: 1,
                        order: 0,
                        authoringModeKind: 'SELECTED',
                        spellIds: [spell.id, 'not-an-authorized-spell']
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
    const result = expandNodeRuntimeResponse(await caller.query(resolve, request))
    const level = result.scopes.find((scope) => scope.mapId === 'spellGrantLevel')
    expect(level?.path).toEqual(['features', 0, 'grants', 'spells', 0, 'progression', 'levels', 0])
    const choices = result.scopes.flatMap((scope) =>
      scope.steps.flatMap((step) => step.sections.flatMap((section) => section.nodes))
    )
    expect(choices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'classId',
          options: [{ value: characterClass.id, label: characterClass.label }]
        }),
        expect.objectContaining({
          id: 'spellIds',
          options: [{ value: spell.id, label: spell.label }]
        })
      ])
    )
    const normalized = await caller.query(normalize, request)
    expect(normalized.values).toHaveProperty(
      'features.0.grants.spells.0.progression.levels.0.spellIds',
      [spell.id]
    )
    expect(normalized.values).toHaveProperty(
      'features.0.grants.spells.0.progression.classId',
      characterClass.id
    )
  })

  it('scopes equipment roots to their owner and rejects missing or stale projections', async () => {
    const { t, caller, userId } = await fixture()
    const { mace } = await importAcolyteEquipment(t)
    const userSourceId = '10000000-0000-4000-8000-000000000094'
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', mace.id))
        .unique()
      if (!root) throw new Error('Missing equipment root fixture')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing equipment version fixture')
      const document = jsonValueSchema.parse(JSON.parse(version.documentJson))
      if (typeof document !== 'object' || document === null || Array.isArray(document)) {
        throw new Error('Invalid equipment document fixture')
      }
      const ownedDocument = { ...document, userId }
      const checksum = checksumRuleDocument(ownedDocument)
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: userSourceId,
        kind: 'USER',
        ownerUserId: userId
      })
      await ctx.db.patch(version._id, {
        checksum,
        contentSourceId: userSourceId,
        documentJson: JSON.stringify(ownedDocument)
      })
      await ctx.db.patch(root._id, {
        ownerUserId: userId,
        checksum,
        contentSourceId: userSourceId,
        authoringSources: authoredSourceFacts({
          subjectKind: 'EQUIPMENT',
          document: equipmentAuthoredDtoSchema.parse({ ...mace, userId }),
          checksum
        }),
        equipmentOptions: {
          checksum,
          category: mace.category,
          properties: mace.properties ?? []
        }
      })
      const otherSystemId = '10000000-0000-4000-8000-000000000098'
      const otherSourceId = '10000000-0000-4000-8000-000000000097'
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: otherSourceId,
        gameSystemId: otherSystemId
      })
      const { _id, _creationTime, ...rootFields } = root
      await ctx.db.insert('authoredRoots', {
        ...rootFields,
        id: '10000000-0000-4000-8000-000000000096',
        label: 'Other System equipment',
        systemId: otherSystemId,
        contentSourceId: otherSourceId
      })
    })
    const ownRows = await t.run((ctx) =>
      createSystemSourceReader(ctx, srdSystemRecord.id, userId).then((reader) =>
        reader('equipment', ['id', 'label'], undefined, srdSystemRecord.id)
      )
    )
    expect(ownRows).toEqual(expect.arrayContaining([{ id: mace.id, label: mace.label }]))
    expect(ownRows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Other System equipment' })])
    )
    expect(
      await caller.query(api.content.equipmentOptions.list, {
        systemId: srdSystemRecord.id
      })
    ).toEqual(ownRows.map(({ id, label }) => ({ value: id, label })))
    const ownedOptions = expandNodeRuntimeResponse(
      await caller.query(resolve, {
        mapId: 'startingEquipmentItem',
        systemId: srdSystemRecord.id,
        values: {
          startingEquipmentKind: 'EQUIPMENT',
          authoringModeKind: 'SELECTED'
        }
      })
    )
    expect(
      ownedOptions.steps.flatMap((step) => step.sections.flatMap((section) => section.nodes))
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'equipmentIds',
          options: expect.arrayContaining([{ value: mace.id, label: mace.label }])
        })
      ])
    )
    await t.run(async (ctx) => {
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', userSourceId))
        .unique()
      if (!source) throw new Error('Missing USER source fixture')
      await ctx.db.patch(source._id, {
        ownerUserId: '10000000-0000-4000-8000-000000000095'
      })
    })
    const mismatchedRows = await t.run((ctx) =>
      createSystemSourceReader(ctx, srdSystemRecord.id, userId).then((reader) =>
        reader('equipment', ['id', 'label'], undefined, srdSystemRecord.id)
      )
    )
    expect(mismatchedRows).not.toEqual(expect.arrayContaining([{ id: mace.id, label: mace.label }]))
    expect(
      await caller.query(api.content.equipmentOptions.list, {
        systemId: srdSystemRecord.id
      })
    ).not.toContainEqual({ value: mace.id, label: mace.label })
    await t.run(async (ctx) => {
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', userSourceId))
        .unique()
      if (!source) throw new Error('Missing USER source fixture')
      await ctx.db.patch(source._id, { ownerUserId: userId })
    })
    const strangerRows = await t.run((ctx) =>
      createSystemSourceReader(
        ctx,
        srdSystemRecord.id,
        '10000000-0000-4000-8000-000000000095'
      ).then((reader) => reader('equipment', ['id', 'label'], undefined, srdSystemRecord.id))
    )
    expect(strangerRows).not.toEqual(expect.arrayContaining([{ id: mace.id, label: mace.label }]))
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', mace.id))
        .unique()
      if (!root) throw new Error('Missing equipment root fixture')
      await ctx.db.patch(root._id, { authoringSources: undefined })
    })
    await expect(
      t.run((ctx) =>
        createSystemSourceReader(ctx, srdSystemRecord.id, userId).then((reader) =>
          reader('equipment', ['id', 'label'], undefined, srdSystemRecord.id)
        )
      )
    ).rejects.toThrow('Authoring source facts are not materialized.')
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', mace.id))
        .unique()
      if (!root) throw new Error('Missing equipment root fixture')
      await ctx.db.patch(root._id, {
        authoringSources: authoredSourceFacts({
          subjectKind: 'EQUIPMENT',
          document: equipmentAuthoredDtoSchema.parse(mace),
          checksum: '0'.repeat(64)
        })
      })
    })
    await expect(
      t.run((ctx) =>
        createSystemSourceReader(ctx, srdSystemRecord.id, userId).then((reader) =>
          reader('equipment', ['id', 'label'], undefined, srdSystemRecord.id)
        )
      )
    ).rejects.toThrow('Stored authoring source checksum mismatch.')
  })

  it('bounds caller-visible sources without counting unrelated USER sources', async () => {
    const { t, userId } = await fixture()
    const { mace } = await importAcolyteEquipment(t)
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', mace.id))
        .unique()
      if (!root) throw new Error('Missing equipment root fixture')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing equipment version fixture')
      const userSourceId = '10000000-0000-4000-8000-000000000093'
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: userSourceId,
        kind: 'USER',
        ownerUserId: userId
      })
      const document = { ...mace, userId }
      const checksum = checksumRuleDocument(document)
      await ctx.db.patch(root._id, {
        contentSourceId: userSourceId,
        ownerUserId: userId,
        checksum,
        authoringSources: authoredSourceFacts({
          subjectKind: 'EQUIPMENT',
          document: equipmentAuthoredDtoSchema.parse(document),
          checksum
        }),
        equipmentOptions: {
          checksum,
          category: mace.category,
          properties: mace.properties ?? []
        }
      })
      await ctx.db.patch(version._id, {
        contentSourceId: userSourceId,
        checksum,
        documentJson: JSON.stringify(document)
      })
      for (let index = 0; index < 101; index++) {
        await ctx.db.insert('contentSources', {
          ...SRD_CONTENT_SOURCE,
          id: `20000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
          kind: 'USER',
          ownerUserId: `30000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
        })
      }
    })
    const rows = await t.run((ctx) =>
      createSystemSourceReader(ctx, srdSystemRecord.id, userId).then((reader) =>
        reader('equipment', ['id', 'label'], undefined, srdSystemRecord.id)
      )
    )
    expect(rows).toEqual(expect.arrayContaining([{ id: mace.id, label: mace.label }]))
    await t.run(async (ctx) => {
      const sources = await ctx.db
        .query('contentSources')
        .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
          q.eq('gameSystemId', srdSystemRecord.id).eq('kind', 'USER')
        )
        .take(103)
      for (const source of sources) await ctx.db.patch(source._id, { ownerUserId: userId })
    })
    await expect(
      t.run((ctx) =>
        createSystemSourceReader(ctx, srdSystemRecord.id, userId).then((reader) =>
          reader('equipment', ['id', 'label'], undefined, srdSystemRecord.id)
        )
      )
    ).rejects.toThrow('System content source limit exceeded.')
  })

  it('backfills missing authoring source facts on exact replay and rejects conflicting facts', async () => {
    const { t, userId } = await fixture()
    const { mace } = await importAcolyteEquipment(t)
    const before = await t.run((ctx) =>
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', mace.id))
        .unique()
    )
    if (!before) throw new Error('Missing equipment root fixture')
    await t.run((ctx) => ctx.db.patch(before._id, { authoringSources: undefined }))
    await expect(
      t.run((ctx) =>
        createSystemSourceReader(ctx, srdSystemRecord.id, userId).then((reader) =>
          reader('equipment', ['id', 'label'], undefined, srdSystemRecord.id)
        )
      )
    ).rejects.toThrow('Authoring source facts are not materialized.')
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject(mace)]
    })
    const replayed = await t.run((ctx) => ctx.db.get(before._id))
    expect(replayed?.currentVersionId).toBe(before.currentVersionId)
    expect(replayed?.checksum).toBe(before.checksum)
    await t.run(async (ctx) => {
      await ctx.db.patch(before._id, {
        authoringSources: {
          checksum: '0'.repeat(64),
          factsVersion: AUTHORED_SOURCE_FACTS_VERSION,
          rows: {}
        }
      })
    })
    await expect(
      importSeededSubjects(t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [importedSubject(mace)]
      })
    ).rejects.toThrow('Canonical content conflict.')
  })

  it('rejects a changed System checksum and a reader used with another System', async () => {
    const { t, caller, userId } = await fixture()
    await expect(
      t.run(async (ctx) => {
        const reader = await createSystemSourceReader(ctx, srdSystemRecord.id, userId)
        return reader('skills', ['id', 'label'], undefined, '10000000-0000-4000-8000-000000000099')
      })
    ).rejects.toThrow('Authoring System mismatch')
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
        .unique()
      if (!stored) throw new Error('Missing System fixture')
      await ctx.db.patch(stored._id, { checksum: '0'.repeat(64) })
    })
    await expect(caller.query(resolve, skillInput)).rejects.toThrow('checksum mismatch')
  })

  it('resolves public and owned definition choices and rejects corrupt definition evidence', async () => {
    const { t, caller, userId } = await fixture()
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [definition]
    })
    const request = {
      mapId: 'feature',
      systemId: srdSystemRecord.id,
      values: {}
    }
    const result = expandNodeRuntimeResponse(await caller.query(resolve, request))
    const nodes = result.steps.flatMap((step) => step.sections.flatMap((section) => section.nodes))
    expect(nodes.find((node) => node.id === 'ruleDefinitionIds')).toMatchObject({
      options: [{ value: definition.id, label: definition.label }]
    })
    await t.run(async (ctx) => {
      const sourceId = crypto.randomUUID()
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: sourceId,
        kind: 'USER',
        ownerUserId: userId
      })
      const stored = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', definition.id))
        .unique()
      if (!stored) throw new Error('Missing definition fixture')
      await ctx.db.patch(stored._id, { contentSourceId: sourceId })
    })
    await expect(caller.query(resolve, request)).rejects.toThrow(
      'Stored authoring definition mismatch'
    )
    await expect(caller.query(normalize, request)).rejects.toThrow(
      'Stored authoring definition mismatch'
    )
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', definition.id))
        .unique()
      if (!stored) throw new Error('Missing definition fixture')
      await ctx.db.patch(stored._id, {
        ownerUserId: userId,
        contractVersion: undefined,
        publishedAt: undefined,
        publishedBy: undefined
      })
    })
    // A publication without its complete metadata is refused.
    await expect(caller.query(resolve, request)).rejects.toThrow(
      'Stored authoring definition mismatch'
    )
    await expect(caller.query(normalize, request)).rejects.toThrow(
      'Stored authoring definition mismatch'
    )
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', definition.id))
        .unique()
      if (!stored) throw new Error('Missing definition fixture')
      await ctx.db.patch(stored._id, {
        contractVersion: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: userId
      })
    })
    expect(expandNodeRuntimeResponse(await caller.query(resolve, request))).toEqual(result)
    const foreignChoices = await t.run((ctx) =>
      createSystemSourceReader(ctx, srdSystemRecord.id, crypto.randomUUID()).then((reader) =>
        reader('reusable_definitions', ['id', 'label'], undefined, srdSystemRecord.id)
      )
    )
    expect(foreignChoices).toEqual([])
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', definition.id))
        .unique()
      if (!stored) throw new Error('Missing definition fixture')
      await ctx.db.patch(stored._id, {
        gameSystemId: '10000000-0000-4000-8000-000000000099'
      })
    })
    await expect(caller.query(resolve, request)).rejects.toThrow(
      'Stored authoring definition mismatch'
    )
  })

  it('lists definition choices from stored identities without decoding their documents', async () => {
    const { t, caller, userId } = await fixture()
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: SRD_REUSABLE_DEFINITIONS.map((entry) =>
        sourceImportDefinitionDtoSchema.parse(entry)
      )
    })
    const request = { mapId: 'feature', systemId: srdSystemRecord.id, values: {} }
    const choices = async () => {
      const node = expandNodeRuntimeResponse(await caller.query(resolve, request))
        .steps.flatMap((step) => step.sections.flatMap((section) => section.nodes))
        .find((item) => item.id === 'ruleDefinitionIds')
      if (!node || !('options' in node)) throw new Error('Expected definition options')
      return node.options
    }
    const full = await t.run(async (ctx) =>
      readCurrentSourceDefinitions(
        ctx,
        await readAuthoringSources(ctx, srdSystemRecord.id, userId),
        userId
      )
    )
    expect(full.length).toBe(SRD_REUSABLE_DEFINITIONS.length)
    const listed = await choices()
    expect(listed.map(({ value, label }) => ({ value, label }))).toEqual(
      full
        .map(({ id, label }) => ({ value: id, label }))
        .sort(
          (left, right) =>
            left.label.localeCompare(right.label) || left.value.localeCompare(right.value)
        )
    )

    // RELIABILITY-21.T24: decoding, parsing and checksumming every definition document cost ~200 ms
    // of resolve's 1 s budget on CI. A choice reads only the stored identity; the document stays
    // guarded wherever it is read.
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', definition.id))
        .unique()
      if (!stored) throw new Error('Missing definition fixture')
      await ctx.db.patch(stored._id, { documentJson: '{"tampered":true}' })
    })
    expect(await choices()).toEqual(listed)
    await expect(t.run((ctx) => readDefinitionRoot(ctx, definition.id, userId))).rejects.toThrow(
      'Reusable definition integrity mismatch.'
    )
  })

  it('publishes imported definitions with their metadata and refuses one without it', async () => {
    const { t, caller } = await fixture()
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [definition]
    })
    const read = () =>
      t.run(async (ctx) => {
        const stored = await ctx.db
          .query('reusableDefinitions')
          .withIndex('by_publicId', (q) => q.eq('id', definition.id))
          .unique()
        if (!stored) throw new Error('Missing definition fixture')
        return { stored, owner: await readSystemOwner(ctx, srdSystemRecord.id) }
      })
    const { stored, owner } = await read()
    expect(stored).toMatchObject({ version: 1, contractVersion: 1, publishedBy: owner })
    expect(Number.isNaN(Date.parse(stored.publishedAt ?? ''))).toBe(false)

    const request = { mapId: 'feature', systemId: srdSystemRecord.id, values: {} }
    await caller.query(resolve, request)
    await t.run((ctx) =>
      ctx.db.patch(stored._id, {
        contractVersion: undefined,
        publishedAt: undefined,
        publishedBy: undefined
      })
    )
    await expect(caller.query(resolve, request)).rejects.toThrow(
      'Stored authoring definition mismatch'
    )
  })

  it('resolves and preserves a reusable rule scope on saving throw modifiers', async () => {
    const { t, caller } = await fixture()
    const concentration = sourceImportDefinitionDtoSchema.parse(
      SRD_REUSABLE_DEFINITIONS.find((entry) => entry.definitionFamilyKey === 'rule-maintenance')
    )
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [concentration]
    })
    const request = {
      mapId: 'modifierGrant',
      systemId: srdSystemRecord.id,
      values: {
        valueDomainCode: 'SAVING_THROW_MODIFIER',
        modifierKind: 'ROLL_INFLUENCE',
        payload: { influence: 'ADVANTAGE' },
        domain: { ability: 'CONSTITUTION', ruleDefinitionId: concentration.id }
      }
    }
    const result = expandNodeRuntimeResponse(await caller.query(resolve, request))
    const domain = result.scopes.find((scope) => scope.mapId === 'modifierGrantDomain')
    const nodes = domain?.steps.flatMap((step) => step.sections.flatMap((section) => section.nodes))
    expect(nodes?.find((node) => node.id === 'ruleDefinitionId')).toMatchObject({
      visible: true,
      options: [{ value: concentration.id, label: concentration.label }]
    })
    const normalized = await caller.query(normalize, request)
    expect(normalized.values).toHaveProperty('domain.ruleDefinitionId', concentration.id)

    const ordinary = await caller.query(normalize, {
      ...request,
      values: { ...request.values, domain: { ability: 'CONSTITUTION' } }
    })
    expect(ordinary.values).not.toHaveProperty('domain.ruleDefinitionId')
  })
})
