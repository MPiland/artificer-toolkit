import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { srdCreatures } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { greatclub } from '@artificer-toolkit/source-data/srd/equipment/greatclub.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import { shieldWoodPlus1 } from '@artificer-toolkit/source-data/srd/equipment/shield-wood-plus-1.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { SRD_DARKVISION_SENSE_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { AUTHORED_LENGTH_AMOUNT_MAX } from '@artificer-toolkit/schema/shared/authoredLimits'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { sourceImportDefinitionDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import {
  creatureResponseDtoSchema,
  type AuthoredDetailReadInput,
  type AuthoredDetailReadResult
} from '@artificer-toolkit/schema/api/content'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import {
  type AuthoredDeleteActiveInput,
  type AuthoredPublicationResult,
  type AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { nodeRuntimeResolveRequestDtoSchema } from '@artificer-toolkit/schema/api/nodeRuntime'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime'
import { compileSubjectWithMechanicsIndex } from '@artificer-toolkit/shared/subjects/compilers'
import { collectReferenceIds, stripPortableMetadata } from '@artificer-toolkit/shared/utils'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api, internal } from '../_generated/api'
import {
  importedSubject,
  publicationFixture,
  versionWithCompilation
} from '../../tests/fixtures/publication'
import { creaturePublicationInput } from '../../tests/fixtures/creatureDrafts'
import { srdPrintedArmorClass } from '../../tests/fixtures/srdCreatures'
import { readVisibleCatalogue } from '../../tests/fixtures/contentSnapshotReaders'
import { readStoredAuthoredVersionDocument } from './documents'

const selectedCreatureIds = new Set([
  '00000000-0000-0000-0070-000200000000',
  '00000000-0000-0000-0070-001c00000000',
  '00000000-0000-0000-0070-011400000000',
  '00000000-0000-0000-0070-011b00000000'
])
const selectedCreatures = srdCreatures.filter((creature) => selectedCreatureIds.has(creature.id))
const creatureByLabel = new Map(selectedCreatures.map((creature) => [creature.label, creature]))
const acolyte = creatureByLabel.get('Acolyte')
const archmage = creatureByLabel.get('Archmage')
const unicorn = creatureByLabel.get('Unicorn')
const warhorse = creatureByLabel.get('Warhorse')
if (!acolyte || !archmage || !unicorn || !warhorse || selectedCreatures.length !== 4)
  throw new Error('Missing selected canonical Creature fixture.')
const defaultCreatureId = warhorse.id
const defaultSystemId = warhorse.systemId

const ruleIds = new Set(
  collectReferenceIds(selectedCreatures, 'ruleDefinitionId', 'ruleDefinitionIds')
)
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
if (definitions.length !== definitionIds.size)
  throw new Error('Creature fixture references missing canonical lifecycle definitions.')

const senseIds = new Set(
  collectReferenceIds(selectedCreatures, 'senseDefinitionId', 'senseDefinitionIds')
)
const senseDefinitions = SRD_SENSE_DEFINITIONS.filter((sense) => senseIds.has(sense.id)).map(
  (sense) => ({ ...sense, definitionFamilyKey: 'sense' as const })
)
if (senseDefinitions.length !== senseIds.size)
  throw new Error('Creature fixture references missing canonical sense definitions.')

const spellIds = new Set(
  selectedCreatures.flatMap((creature) => collectReferenceIds(creature, 'spellId', 'spellIds'))
)
const equipmentIds = new Set(
  selectedCreatures.flatMap((creature) =>
    collectReferenceIds(creature, 'equipmentId', 'equipmentIds')
  )
)
const referencedSpells = srdSpells.filter((spell) => spellIds.has(spell.id))
const referencedEquipment = srdEquipment.filter((equipment) => equipmentIds.has(equipment.id))
if (referencedSpells.length !== spellIds.size || referencedEquipment.length !== equipmentIds.size)
  throw new Error('Creature fixture references missing canonical source records.')

// A magic shield whose armor class modifier is not the while-equipped form a Creature can evaluate.
const unevaluableShield = {
  ...shieldWoodPlus1,
  id: '00000000-0000-0000-0050-0ff000000000',
  label: 'Unevaluable Shield',
  modifiers: shieldWoodPlus1.modifiers?.map((modifier) => ({
    ...modifier,
    restrictions: undefined
  }))
}
const fixtureEquipment = [
  ...new Map(
    [...referencedEquipment, greatclub, shieldWood, unevaluableShield].map(
      (equipment) => [equipment.id, equipment] as const
    )
  ).values()
]

const fixtureSubjects = [
  ...selectedCreatures.map((creature) =>
    importedSubject({
      subjectKind: 'CREATURE',
      ...creature,
      document: creature
    })
  ),
  ...referencedSpells.map((spell) =>
    importedSubject({ subjectKind: 'SPELL', ...spell, document: spell })
  ),
  ...fixtureEquipment.map((equipment) =>
    importedSubject({
      subjectKind: 'EQUIPMENT',
      ...equipment,
      document: equipment
    })
  )
]
const fixtureBatches = Array.from({ length: Math.ceil(fixtureSubjects.length / 10) }, (_, index) =>
  fixtureSubjects.slice(index * 10, index * 10 + 10)
)

const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)
const details = makeFunctionReference<'query', AuthoredDetailReadInput, AuthoredDetailReadResult>(
  'content/details:get'
)

async function fixture() {
  const setup = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    fixtureBatches
  )
  await setup.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [...definitions, ...senseDefinitions].map((definition) =>
      sourceImportDefinitionDtoSchema.parse(definition)
    )
  })
  return setup
}

async function copyDraft(
  caller: Awaited<ReturnType<typeof fixture>>['first']['caller'],
  subjectId = defaultCreatureId
) {
  return caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'CREATURE',
    subjectId
  })
}

describe('native Creature publication', () => {
  it('refuses to publish a Creature attack that does not define exactly one ATTACK roll', async () => {
    const { first } = await fixture()
    const draft = await copyDraft(first.caller)
    const copied = creatureAuthoredDtoSchema.parse(draft.payload)
    const withoutAttackRoll = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Homebrew Warhorse',
      payload: {
        ...copied,
        features: copied.features?.map((feature) =>
          feature.label === 'Hooves' ? { ...feature, rollDefinitions: [] } : feature
        )
      }
    })

    await expect(
      first.caller.mutation(publish, creaturePublicationInput(withoutAttackRoll))
    ).rejects.toThrow(
      '"Hooves" makes an attack, so it must define exactly one ATTACK roll with its attack bonus (it defines 0).'
    )
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'CREATURE',
        subjectId: draft.subjectId
      })
    ).toEqual(withoutAttackRoll)
  })

  it('refuses to publish a Creature size the System does not list', async () => {
    const { first } = await fixture()
    const draft = await copyDraft(first.caller)
    const copied = creatureAuthoredDtoSchema.parse(draft.payload)
    const enormous = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Homebrew Warhorse',
      payload: { ...copied, size: 'ENORMOUS' }
    })

    await expect(
      first.caller.mutation(publish, creaturePublicationInput(enormous))
    ).rejects.toThrow('The Game System does not define the size "ENORMOUS".')
  })

  it('publishes a Creature sense and refuses a sense the room could not run', async () => {
    const { first, t } = await fixture()
    const draft = await copyDraft(first.caller)
    const copied = creatureAuthoredDtoSchema.parse(draft.payload)
    const saveWithSenses = (senses: unknown) =>
      first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'CREATURE',
        subjectId: draft.subjectId,
        systemId: draft.systemId,
        label: 'Homebrew Warhorse',
        payload: { ...copied, senses }
      })
    const sense = (
      senseDefinitionId: string,
      range: unknown = { id: 'range', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' }
    ) => ({ senseDefinitionId, range })
    const saveAndPublish = async (senses: unknown) =>
      first.caller.mutation(publish, creaturePublicationInput(await saveWithSenses(senses)))

    // A published sense definition the System does not list, and one that belongs to another System.
    const darkvision = SRD_SENSE_DEFINITIONS.find(({ id }) => id === SRD_DARKVISION_SENSE_ID)
    if (!darkvision) throw new Error('Missing SRD Darkvision.')
    const unlistedSenseId = '00000000-0000-0000-000a-0ff000000001'
    const unlistedDocument = { ...darkvision.document, id: unlistedSenseId }
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [
        sourceImportDefinitionDtoSchema.parse({
          id: unlistedSenseId,
          label: 'Unlisted Sense',
          description: darkvision.description,
          definitionFamilyKey: 'sense',
          document: unlistedDocument,
          checksum: checksumRuleDocument(unlistedDocument)
        })
      ]
    })
    const foreignSenseId = '00000000-0000-0000-000a-0ff000000002'
    await t.run(async (ctx) => {
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', SRD_CONTENT_SOURCE.id))
        .unique()
      const definition = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', SRD_DARKVISION_SENSE_ID))
        .unique()
      if (!source || !definition) throw new Error('Missing SRD source or Darkvision row.')
      const { _id: _sourceRow, _creationTime: _sourceCreated, ...sourceFields } = source
      const {
        _id: _definitionRow,
        _creationTime: _definitionCreated,
        ...definitionFields
      } = definition
      const foreignSystemId = '00000000-0000-0000-0001-0ff000000000'
      await ctx.db.insert('contentSources', {
        ...sourceFields,
        id: '00000000-0000-0000-0002-0ff000000000',
        gameSystemId: foreignSystemId
      })
      await ctx.db.insert('reusableDefinitions', {
        ...definitionFields,
        id: foreignSenseId,
        contentSourceId: '00000000-0000-0000-0002-0ff000000000',
        gameSystemId: foreignSystemId
      })
    })

    // Node-map normalization drops a sense id outside the System vocabulary (unknown, another
    // System's, or unlisted), so publication then finds the sense without its definition id.
    const droppedSense =
      /"senseDefinitionId"\s*\],\s*"message": "Invalid input: expected string, received undefined"/
    for (const senseDefinitionId of [
      '00000000-0000-0000-000a-0ff000000000',
      foreignSenseId,
      unlistedSenseId
    ])
      await expect(saveAndPublish([sense(senseDefinitionId)])).rejects.toThrow(droppedSense)
    // An empty id survives normalization and names no definition.
    await expect(saveAndPublish([sense('')])).rejects.toThrow(
      'Every Creature sense must reference a published sense definition.'
    )
    await expect(
      saveAndPublish([sense(SRD_DARKVISION_SENSE_ID), sense(SRD_DARKVISION_SENSE_ID)])
    ).rejects.toThrow('A Creature can have each sense only once.')
    await expect(
      saveAndPublish([
        sense(SRD_DARKVISION_SENSE_ID, { id: '', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' })
      ])
    ).rejects.toThrow('Too small: expected string to have >=1 characters')
    await expect(
      saveAndPublish([
        sense(SRD_DARKVISION_SENSE_ID, {
          id: 'range',
          rangeKind: 'DISTANCE',
          amount: AUTHORED_LENGTH_AMOUNT_MAX + 1,
          unit: 'FEET'
        })
      ])
    ).rejects.toThrow(`Too big: expected number to be <=${AUTHORED_LENGTH_AMOUNT_MAX}`)

    const published = await saveAndPublish([sense(SRD_DARKVISION_SENSE_ID)])
    const detail = await first.caller.query(details, {
      subjectKind: 'CREATURE',
      id: published.subjectId
    })
    expect(creatureResponseDtoSchema.parse(detail)?.item?.senses).toEqual([
      expect.objectContaining({
        senseDefinitionId: SRD_DARKVISION_SENSE_ID,
        range: expect.objectContaining({ rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' })
      })
    ])
  })

  it('refuses a Creature speed the room could not run, so reads never meet one', async () => {
    const { first } = await fixture()
    const draft = await copyDraft(first.caller)
    const copied = creatureAuthoredDtoSchema.parse(draft.payload)
    const [walk] = copied.speeds ?? []
    if (!walk) throw new Error('Missing Warhorse speed.')
    const saveAndPublish = async (speeds: unknown) =>
      first.caller.mutation(
        publish,
        creaturePublicationInput(
          await first.caller.mutation(api.content.drafts.save, {
            subjectKind: 'CREATURE',
            subjectId: draft.subjectId,
            systemId: draft.systemId,
            label: 'Homebrew Warhorse',
            payload: { ...copied, speeds }
          })
        )
      )

    // Node-map normalization drops a speed id outside the System vocabulary, so publication then
    // finds the speed without its id.
    await expect(
      saveAndPublish([{ ...walk, speedId: '00000000-0000-0000-000b-0ff000000000' }])
    ).rejects.toThrow(
      /"speedId"\s*\],\s*"message": "Invalid input: expected string, received undefined"/
    )
    await expect(saveAndPublish([{ speedId: walk.speedId, amount: 40 }])).rejects.toThrow()
    await expect(
      saveAndPublish([{ speedId: walk.speedId, amount: 40, unit: 'FURLONGS' }])
    ).rejects.toThrow()
    await expect(
      saveAndPublish([{ speedId: walk.speedId, amount: 'fast', unit: 'FEET' }])
    ).rejects.toThrow()
    await expect(
      saveAndPublish([
        { speedId: walk.speedId, amount: AUTHORED_LENGTH_AMOUNT_MAX + 1, unit: 'FEET' }
      ])
    ).rejects.toThrow(`Too big: expected number to be <=${AUTHORED_LENGTH_AMOUNT_MAX}`)

    const published = await saveAndPublish([{ ...walk, amount: 40, unit: 'YARDS' }])
    const detail = await first.caller.query(details, {
      subjectKind: 'CREATURE',
      id: published.subjectId
    })
    expect(creatureResponseDtoSchema.parse(detail)?.item?.speeds).toEqual([
      expect.objectContaining({ speedId: walk.speedId, amount: 40, unit: 'YARDS' })
    ])
  })

  it('returns the computed armor class on Creature detail reads', async () => {
    const { first } = await fixture()
    for (const creature of selectedCreatures) {
      const detail = await first.caller.query(details, {
        subjectKind: 'CREATURE',
        id: creature.id
      })
      expect(creatureResponseDtoSchema.parse(detail)?.armorClass, creature.label).toBe(
        srdPrintedArmorClass(creature)
      )
    }
  })

  it('publishes canonical indexed Creature copies with cloned loadout bindings, source facts, and private active detail', async () => {
    const { t, first, second } = await fixture()
    const canonicalBefore = await t.run(async (ctx) =>
      Promise.all(
        selectedCreatures.map(async (creature) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', creature.id))
            .unique()
          if (!root) throw new Error(`Missing canonical Creature ${creature.label}`)
          return [
            creature.id,
            { checksum: root.checksum, versionId: root.currentVersionId }
          ] as const
        })
      )
    )
    const copies: Array<{
      draft: AuthoredDraftResult
      result: AuthoredPublicationResult
    }> = []
    for (const creature of selectedCreatures) {
      const draft = await copyDraft(first.caller, creature.id)
      const draftExport = await first.caller.query(api.content.exports.get, {
        subjectKind: 'CREATURE',
        id: draft.publicId,
        view: 'draft'
      })
      expect(draftExport.item).toEqual({
        kind: 'CREATURE',
        data: stripPortableMetadata(draft.payload)
      })
      copies.push({
        draft,
        result: await first.caller.mutation(publish, creaturePublicationInput(draft))
      })
    }
    const masterIds = selectedCreatures.map((creature) => creature.id).sort()
    expect(
      (
        await readVisibleCatalogue(t, first.caller, 'CREATURE', {
          systemId: defaultSystemId
        })
      )
        .map((item) => item.id)
        .sort()
    ).toEqual([...masterIds, ...copies.map(({ draft }) => draft.subjectId)].sort())
    expect(
      (
        await readVisibleCatalogue(t, second.caller, 'CREATURE', {
          systemId: defaultSystemId
        })
      )
        .map((item) => item.id)
        .sort()
    ).toEqual(masterIds)
    expect(
      await readVisibleCatalogue(t, first.caller, 'CREATURE', {
        systemId: crypto.randomUUID()
      })
    ).toEqual([])
    const stored = await t.run(async (ctx) =>
      Promise.all(
        copies.map(async ({ draft, result }) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
            .unique()
          if (!root) throw new Error(`Missing published Creature ${draft.label}`)
          const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
          const route = await ctx.db
            .query('authoredRouteIds')
            .withIndex('by_subjectId', (q) => q.eq('subjectId', draft.subjectId))
            .unique()
          return {
            draft,
            result,
            root,
            route,
            version,
            document: version && (await readStoredAuthoredVersionDocument(ctx, version))
          }
        })
      )
    )
    for (const entry of stored) {
      const copied = creatureAuthoredDtoSchema.parse(entry.draft.payload)
      const document = creatureAuthoredDtoSchema.parse(entry.document)
      const projection = jsonValueSchema.parse(
        JSON.parse(entry.version!.compilation!.projectionJson)
      )
      const canonical = selectedCreatures.find(
        (creature) => creature.label === copied.label.replace(/ Copy$/, '')
      )
      expect(canonical).toBeDefined()
      expect(entry.result).toMatchObject({
        subjectKind: 'CREATURE',
        subjectId: entry.draft.subjectId,
        publicId: entry.draft.publicId
      })
      expect(entry.root).toMatchObject({
        subjectKind: 'CREATURE',
        ownerUserId: first.userId,
        catalogue: expect.objectContaining({ category: document.category })
      })
      expect(entry.route?.publicId).toBe(entry.draft.publicId)
      expect(entry.version?.checksum).toBe(entry.result.checksum)
      expect(document).toMatchObject({ ...copied, status: 'ACTIVE' })
      expect(checksumRuleDocument(document)).toBe(entry.result.checksum)
      const resolved = await first.caller.query(
        api.authoring.nodeRuntime.resolve,
        nodeRuntimeResolveRequestDtoSchema.parse({
          mapId: 'creature',
          systemId: document.systemId,
          values: document
        })
      )
      expect(resolved.mapId).toBe('creature')
      expect(resolved.steps.length).toBeGreaterThan(0)
      const exported = await first.caller.query(api.content.exports.get, {
        subjectKind: 'CREATURE',
        id: entry.draft.publicId,
        view: 'active'
      })
      expect(exported.item).toEqual({
        kind: 'CREATURE',
        data: stripPortableMetadata(document)
      })
      await expect(
        second.caller.query(api.content.exports.get, {
          subjectKind: 'CREATURE',
          id: entry.draft.subjectId,
          view: 'active'
        })
      ).rejects.toThrow('Only owned authored content')
      expect(entry.version?.compilation?.authoredChecksum).toBe(entry.result.checksum)
      expect(projection).toEqual(
        JSON.parse(
          JSON.stringify(
            compileSubjectWithMechanicsIndex({
              subjectKind: 'CREATURE',
              authored: document
            }).compiled
          )
        )
      )
      expect(entry.version?.compilation?.projectionChecksum).toBe(checksumRuleDocument(projection))
      expect(entry.root.authoringSources).toEqual(
        authoredSourceFacts({
          subjectKind: 'CREATURE',
          document,
          checksum: entry.result.checksum
        })
      )
      expect(document.abilityScores).toEqual(copied.abilityScores)
      expect(document.proficiencies).toEqual(copied.proficiencies)
      expect(document.features).toEqual(copied.features)
      expect(collectReferenceIds(document, 'spellId', 'spellIds')).toEqual(
        collectReferenceIds(canonical, 'spellId', 'spellIds')
      )
      expect(
        document.features?.map((feature) =>
          feature.grants?.spells?.map(({ castingAbility, charges }) => ({
            castingAbility,
            charges
          }))
        )
      ).toEqual(
        copied.features?.map((feature) =>
          feature.grants?.spells?.map(({ castingAbility, charges }) => ({
            castingAbility,
            charges
          }))
        )
      )
      for (const [index, loadout] of (document.equipmentLoadout ?? []).entries()) {
        const copiedLoadout = copied.equipmentLoadout?.[index]
        const canonicalLoadout = canonical?.equipmentLoadout?.[index]
        expect(
          loadout.actionFeatureIds.every((featureId) =>
            document.features?.some((feature) => feature.id === featureId)
          )
        ).toBe(true)
        expect(loadout.id).toBe(copiedLoadout?.id)
        expect(loadout.id).not.toBe(canonicalLoadout?.id)
        expect(loadout.actionFeatureIds).toEqual(copiedLoadout?.actionFeatureIds)
        expect(loadout.equipmentId).toBe(copiedLoadout?.equipmentId)
        expect(loadout.equipmentId).toBe(canonicalLoadout?.equipmentId)
        expect(
          loadout.actionFeatureIds.every(
            (featureId) => !canonicalLoadout?.actionFeatureIds.includes(featureId)
          )
        ).toBe(true)
      }
      for (const [index, feature] of document.features.entries()) {
        const canonicalFeature = canonical?.features?.[index]
        expect(feature.id).toBe(copied.features?.[index]?.id)
        expect(feature.id).not.toBe(canonicalFeature?.id)
        for (const [effectIndex, effect] of (feature.effects ?? []).entries()) {
          expect(effect.id).toBe(copied.features?.[index]?.effects?.[effectIndex]?.id)
          expect(effect.id).not.toBe(canonicalFeature?.effects?.[effectIndex]?.id)
        }
      }
      expect(
        await first.caller.query(api.content.drafts.get, {
          subjectKind: 'CREATURE',
          subjectId: entry.draft.subjectId
        })
      ).toBeNull()
      expect(
        await t.query(details, {
          subjectKind: 'CREATURE',
          id: entry.draft.subjectId
        })
      ).toBeNull()
      expect(
        await second.caller.query(details, {
          subjectKind: 'CREATURE',
          id: entry.draft.subjectId
        })
      ).toBeNull()
      const detail = creatureResponseDtoSchema.parse(
        await first.caller.query(details, {
          subjectKind: 'CREATURE',
          id: entry.draft.publicId,
          meta: [
            'challengeRatings',
            'conditionTypes',
            'creatureTypes',
            'damageTypes',
            'equipment',
            'speeds'
          ]
        })
      )
      expect(detail).toMatchObject({
        item: { id: entry.draft.subjectId, status: 'ACTIVE' },
        meta: {
          challengeRatings: [{ value: document.challengeRatingId, label: expect.any(String) }],
          creatureTypes: [{ value: document.creatureTypeId, label: expect.any(String) }],
          conditionTypes: expect.any(Array),
          damageTypes: expect.any(Array),
          speeds: expect.any(Array)
        }
      })
      expect(detail?.meta?.equipment?.map((option) => option.value).sort()).toEqual(
        collectReferenceIds(document.equipmentLoadout, 'equipmentId', 'equipmentIds').sort()
      )
    }
    expect(
      await t.run(async (ctx) =>
        Promise.all(
          canonicalBefore.map(async ([id]) => {
            const root = await ctx.db
              .query('authoredRoots')
              .withIndex('by_publicId', (q) => q.eq('id', id))
              .unique()
            return (
              root && {
                checksum: root.checksum,
                versionId: root.currentVersionId
              }
            )
          })
        )
      )
    ).toEqual(canonicalBefore.map(([, before]) => before))
  })

  it('preserves a custom Beast mount profile and clears it when a Companion replacement supplies its profile', async () => {
    const { first } = await fixture()
    const draft = await copyDraft(first.caller)
    const copied = creatureAuthoredDtoSchema.parse(draft.payload)
    const beast = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Custom Warhorse',
      payload: {
        ...copied,
        category: 'BEAST',
        naturalArmorBonus: 2,
        hitPoints: 24,
        damageVulnerabilities: ['radiant while in shadow'],
        damageResistances: ['nonmagical weapon damage'],
        damageImmunities: ['poison'],
        conditionImmunities: ['charmed'],
        carryingCapacity: { amount: 540, unit: 'POUNDS' },
        logisticsNotes: ['Stable-fed', { value: 'Pack trained' }],
        mountProfile: {
          mountType: 'CONTROLLED',
          capacity: 540,
          riderCount: 1,
          notes: 'Saddle trained.'
        }
      }
    })
    await first.caller.mutation(publish, creaturePublicationInput(beast))
    const beastDetail = await first.caller.query(details, {
      subjectKind: 'CREATURE',
      id: beast.subjectId
    })
    expect(creatureAuthoredDtoSchema.parse(beastDetail?.item)).toMatchObject({
      category: 'BEAST',
      naturalArmorBonus: 2,
      hitPoints: 24,
      damageVulnerabilities: ['radiant while in shadow'],
      damageResistances: ['nonmagical weapon damage'],
      damageImmunities: ['poison'],
      conditionImmunities: ['charmed'],
      carryingCapacity: { amount: 540, unit: 'POUNDS' },
      logisticsNotes: ['Stable-fed', 'Pack trained'],
      mountProfile: expect.objectContaining({
        mountType: 'CONTROLLED',
        riderCount: 1
      })
    })
    const companion = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: beast.subjectId,
      systemId: beast.systemId,
      label: 'Companion Warhorse',
      payload: {
        ...beast.payload,
        category: 'COMPANION',
        companionProfile: {
          bondType: 'ANIMAL_COMPANION',
          initiativeMode: 'USES_PC_INITIATIVE',
          notes: 'Trusted companion.'
        },
        mountProfile: beast.payload.mountProfile
      }
    })
    const replacement = await first.caller.mutation(publish, creaturePublicationInput(companion))
    const companionDetail = creatureAuthoredDtoSchema.parse(
      (
        await first.caller.query(details, {
          subjectKind: 'CREATURE',
          id: beast.subjectId
        })
      )?.item
    )
    expect(companionDetail).toMatchObject({
      category: 'COMPANION',
      companionProfile: expect.objectContaining({
        bondType: 'ANIMAL_COMPANION'
      })
    })
    expect(companionDetail.mountProfile).toBeUndefined()
    expect(replacement.publicId).toBe(beast.publicId)
  })

  it('preserves active Creature state for stale or invalid loadout publication and replaces it only with a valid revision', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller, archmage.id)
    await first.caller.mutation(publish, creaturePublicationInput(draft))
    const activeBefore = await first.caller.query(details, {
      subjectKind: 'CREATURE',
      id: draft.subjectId
    })
    const activeRootBefore = await t.run((ctx) =>
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
        .unique()
    )
    if (!activeRootBefore) throw new Error('Missing active Creature root')
    const copied = creatureAuthoredDtoSchema.parse(draft.payload)
    const loadout = copied.equipmentLoadout?.[0]
    if (!loadout) throw new Error('Archmage fixture requires indexed equipment loadout.')
    const stale = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Working Archmage',
      payload: { ...copied, description: 'Unpublished edit' }
    })
    await expect(first.caller.mutation(publish, creaturePublicationInput(draft))).rejects.toThrow(
      'draft or published content changed'
    )
    expect(
      await first.caller.query(details, {
        subjectKind: 'CREATURE',
        id: draft.subjectId
      })
    ).toMatchObject({
      item: activeBefore?.item,
      activeUpdatedAt: activeBefore?.activeUpdatedAt,
      hasDraft: true
    })
    const versionsBefore = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(3)
    )
    for (const loadoutPatch of [
      { ...loadout, actionFeatureIds: [crypto.randomUUID()] },
      { ...loadout, quantity: 0 },
      { ...loadout, equipmentId: crypto.randomUUID() }
    ]) {
      const invalid = await first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'CREATURE',
        subjectId: draft.subjectId,
        systemId: draft.systemId,
        label: 'Broken Archmage',
        payload: { ...stale.payload, equipmentLoadout: [loadoutPatch] }
      })
      await expect(
        first.caller.mutation(publish, creaturePublicationInput(invalid))
      ).rejects.toThrow()
      expect(
        await first.caller.query(api.content.drafts.get, {
          subjectKind: 'CREATURE',
          subjectId: draft.subjectId
        })
      ).toEqual(invalid)
      expect(
        await t.run((ctx) =>
          ctx.db
            .query('authoredVersions')
            .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
            .take(3)
        )
      ).toEqual(versionsBefore)
      expect(
        await t.run((ctx) =>
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
            .unique()
        )
      ).toMatchObject({
        currentVersionId: activeRootBefore.currentVersionId,
        checksum: activeRootBefore.checksum
      })
    }
    const replacement = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Replacement Archmage',
      payload: { ...copied, description: 'Published replacement' }
    })
    const result = await first.caller.mutation(publish, creaturePublicationInput(replacement))
    const versionsAfter = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(3)
    )
    expect(result.publicId).toBe(draft.publicId)
    expect(versionsAfter).toHaveLength(1)
    expect(versionsAfter[0]).toMatchObject({
      version: 2,
      checksum: result.checksum
    })
    expect(await t.run((ctx) => ctx.db.get(activeRootBefore.currentVersionId))).toBeNull()
  })

  it('publishes a hand loadout and refuses a two-handed weapon that crowds the other hand', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller, archmage.id)
    const copied = creatureAuthoredDtoSchema.parse(draft.payload)
    const entry = (
      equipmentId: string,
      useState: 'MAIN_HAND' | 'OFF_HAND' | 'CARRIED' | 'WORN'
    ) => ({
      id: crypto.randomUUID(),
      equipmentId,
      quantity: 1,
      useState,
      attuned: false,
      actionFeatureIds: []
    })
    const saveLoadout = (equipmentLoadout: ReturnType<typeof entry>[]) =>
      first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'CREATURE',
        subjectId: draft.subjectId,
        systemId: draft.systemId,
        label: 'Hand Archmage',
        payload: { ...copied, equipmentLoadout }
      })
    const versionsBefore = async () =>
      t.run((ctx) =>
        ctx.db
          .query('authoredVersions')
          .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
          .take(3)
      )
    const refused = [
      {
        loadout: [entry(dagger.id, 'MAIN_HAND'), entry(greatclub.id, 'OFF_HAND')],
        message: 'A two-handed item cannot be held in the off hand.'
      },
      {
        loadout: [entry(greatclub.id, 'MAIN_HAND'), entry(dagger.id, 'OFF_HAND')],
        message: 'A two-handed main-hand item blocks the off hand.'
      }
    ]
    for (const { loadout, message } of refused) {
      const invalid = await saveLoadout(loadout)
      await expect(
        first.caller.mutation(publish, creaturePublicationInput(invalid))
      ).rejects.toThrow(message)
      expect(await versionsBefore()).toEqual([])
    }

    const valid = await saveLoadout([
      entry(dagger.id, 'MAIN_HAND'),
      entry(dagger.id, 'OFF_HAND'),
      entry(greatclub.id, 'CARRIED'),
      entry(dagger.id, 'WORN')
    ])
    await first.caller.mutation(publish, creaturePublicationInput(valid))
    const [published] = await versionsBefore()
    if (!published) throw new Error('Missing published hand loadout version.')
    const stored = await t.run((ctx) => readStoredAuthoredVersionDocument(ctx, published))
    expect(
      creatureAuthoredDtoSchema.parse(stored).equipmentLoadout?.map((current) => current.useState)
    ).toEqual(['MAIN_HAND', 'OFF_HAND', 'CARRIED', 'WORN'])

    const twoHandedMain = await saveLoadout([
      entry(greatclub.id, 'MAIN_HAND'),
      entry(dagger.id, 'CARRIED')
    ])
    await first.caller.mutation(publish, creaturePublicationInput(twoHandedMain))
    expect(await versionsBefore()).toHaveLength(1)
  })

  it('reads a null armor class, and refuses publication, for Equipment a Creature cannot evaluate', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller, archmage.id)
    const copied = creatureAuthoredDtoSchema.parse(draft.payload)
    const saved = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Odd Shield Archmage',
      payload: {
        ...copied,
        equipmentLoadout: [
          {
            id: crypto.randomUUID(),
            equipmentId: unevaluableShield.id,
            quantity: 1,
            useState: 'OFF_HAND',
            attuned: false,
            actionFeatureIds: []
          }
        ]
      }
    })

    const detail = await first.caller.query(details, {
      subjectKind: 'CREATURE',
      id: draft.subjectId,
      view: 'draft'
    })
    expect(creatureResponseDtoSchema.parse(detail)?.armorClass).toBeNull()

    await expect(first.caller.mutation(publish, creaturePublicationInput(saved))).rejects.toThrow(
      `Equipment "${unevaluableShield.id}" has an armor class modifier that is not the while-equipped form, which a Creature cannot evaluate.`
    )
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredVersions')
          .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
          .take(1)
      )
    ).toEqual([])
  })

  it('denies unauthorized or conflicting Creature publication and preserves the conflicting draft', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    const input = creaturePublicationInput(draft)
    await expect(t.mutation(publish, input)).rejects.toThrow()
    await expect(second.caller.mutation(publish, input)).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input, subjectId: warhorse.id })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input, subjectKind: 'BACKGROUND' })
    ).rejects.toThrow()
    await first.caller.mutation(publish, input)
    const duplicate = await copyDraft(first.caller)
    const conflict = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: duplicate.subjectId,
      systemId: duplicate.systemId,
      label: ` ${draft.label.toUpperCase()} `,
      payload: duplicate.payload
    })
    await expect(
      first.caller.mutation(publish, creaturePublicationInput(conflict))
    ).rejects.toThrow('ACTIVE_NAME_CONFLICT')
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'CREATURE',
        subjectId: duplicate.subjectId
      })
    ).toEqual(conflict)
  })

  it('deletes only owned active Creatures, retaining a working draft or removing a route without one', async () => {
    const { t, first, second } = await fixture()
    const owned = await copyDraft(first.caller)
    await first.caller.mutation(publish, creaturePublicationInput(owned))
    const deleteInput = {
      subjectKind: 'CREATURE' as const,
      subjectId: owned.subjectId
    }
    await expect(t.mutation(deleteActive, deleteInput)).rejects.toThrow()
    await expect(second.caller.mutation(deleteActive, deleteInput)).rejects.toThrow()
    await expect(
      first.caller.mutation(deleteActive, {
        ...deleteInput,
        subjectId: warhorse.id
      })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(deleteActive, {
        ...deleteInput,
        subjectKind: 'BACKGROUND'
      })
    ).rejects.toThrow()
    const working = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: owned.subjectId,
      systemId: owned.systemId,
      label: 'Working Warhorse',
      payload: owned.payload
    })
    await first.caller.mutation(deleteActive, deleteInput)
    const retained = await first.caller.query(api.content.drafts.get, {
      subjectKind: 'CREATURE',
      subjectId: owned.subjectId
    })
    expect(retained).toMatchObject({
      subjectId: working.subjectId,
      publicId: working.publicId,
      userId: working.userId,
      systemId: working.systemId,
      payload: working.payload,
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null
    })
    expect(retained?.updatedAt).not.toBe(working.updatedAt)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredDrafts')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', owned.subjectId))
          .unique()
      )
    ).toMatchObject({ basePublishedChecksum: null })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', owned.subjectId))
          .unique()
      )
    ).toMatchObject({ publicId: owned.publicId })
    expect(
      await first.caller.query(details, {
        subjectKind: 'CREATURE',
        id: owned.subjectId
      })
    ).toBeNull()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredCatalogueOwnerCounts')
          .withIndex('by_subjectKind_ownerUserId', (q) =>
            q.eq('subjectKind', 'CREATURE').eq('ownerUserId', first.userId)
          )
          .unique()
      )
    ).toBeNull()
    const withoutDraft = await copyDraft(first.caller, unicorn.id)
    await first.caller.mutation(publish, creaturePublicationInput(withoutDraft))
    await first.caller.mutation(deleteActive, {
      subjectKind: 'CREATURE',
      subjectId: withoutDraft.subjectId
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', withoutDraft.subjectId))
          .unique()
      )
    ).toBeNull()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', warhorse.id))
          .unique()
      )
    ).not.toBeNull()
  })
})
