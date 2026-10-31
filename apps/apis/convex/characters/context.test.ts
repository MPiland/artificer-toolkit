import { readStoredSourceFacts, writeSourceFacts } from '../content/sourceFacts'
import { describe, expect, it } from 'vitest'
import { authoredDraftCommandInputSchema } from '@artificer-toolkit/schema/api/authoredDrafts'
import type { AuthoredPublishDraftInput } from '@artificer-toolkit/schema/api/authoredPublication'
import { authoredCurrentSourceIdentitySchema } from '@artificer-toolkit/schema/api/authoredPublication'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { composeCharacterRulePolicyFacts } from '@artificer-toolkit/rules-runtime/character/characterRulePolicyFacts'
import type { CharacterRuleContext } from '@artificer-toolkit/rules-runtime/character/characterRuleContext'
import { evaluateInstalledCharacterPolicy } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { compileFeature } from '@artificer-toolkit/shared/compilers'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import { elf, highElf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  corruptPublishedVersionPayload,
  importedSubject,
  importSeededSubjects
} from '../../tests/fixtures/publication'
import { api } from '../_generated/api'
import { loadCharacterRuleContext } from './context'
import { loadCharacterBuilderContext } from './builderContext'
import { fixture, input } from '../../tests/fixtures/characters'

async function serializableContext(...args: Parameters<typeof loadCharacterRuleContext>) {
  const {
    spellsById,
    currentSpellsById,
    creaturesById,
    vehiclesById,
    publications,
    sourceIdentities,
    ...context
  } = await loadCharacterRuleContext(...args)
  return {
    ...context,
    registry: {
      ...context.registry,
      acquiredEquipmentByItemId: Object.fromEntries(context.registry.acquiredEquipmentByItemId)
    },
    spellsById: Object.fromEntries(spellsById),
    currentSpellsById: Object.fromEntries(currentSpellsById),
    creaturesById: Object.fromEntries(creaturesById),
    vehiclesById: Object.fromEntries(vehiclesById),
    publications: Object.fromEntries(publications),
    sourceIdentities: Object.fromEntries(sourceIdentities)
  }
}

function ruleContext(
  context: Awaited<ReturnType<typeof serializableContext>>
): CharacterRuleContext {
  return {
    ...context,
    registry: {
      ...context.registry,
      acquiredEquipmentByItemId: new Map(Object.entries(context.registry.acquiredEquipmentByItemId))
    }
  }
}

function background(userId: string, label: string) {
  return backgroundAuthoredDtoSchema.parse({
    kind: 'BACKGROUND',
    id: crypto.randomUUID(),
    systemId: srdSystemRecord.id,
    userId,
    label,
    description: '',
    proficiencies: acolyte.proficiencies?.slice(0, 1)
  })
}

async function publish<T extends { id: string; systemId: string; label: string }>(
  caller: Awaited<ReturnType<typeof fixture>>['owner']['caller'],
  subjectKind: Exclude<AuthoredPublishDraftInput['subjectKind'], 'CLASS'>,
  document: T
) {
  const draft = await caller.mutation(
    api.content.drafts.save,
    authoredDraftCommandInputSchema.parse({
      subjectKind,
      subjectId: document.id,
      systemId: document.systemId,
      label: document.label,
      payload: JSON.parse(JSON.stringify(document))
    })
  )
  if (!draft.updatedAt) throw new Error('Missing publication draft timestamp.')
  await caller.mutation(api.content.publication.publishDraft, {
    subjectKind,
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

describe('native current Character rule context', () => {
  it('feeds native policy from current published sources and ignores their working drafts', async () => {
    const { t, owner } = await fixture()
    const authored = background(owner.userId, 'Current background')
    await publish(owner.caller, 'BACKGROUND', authored)
    const draft = await owner.caller.mutation(api.characters.drafts.create, input())
    const saved = await owner.caller.mutation(api.characters.drafts.save, {
      expectedDraftId: draft.id,
      characterId: draft.characterId,
      mode: 'create',
      character: {
        ...draft.payload.character,
        intent: {
          ...draft.payload.character.intent,
          background: { backgroundId: authored.id }
        }
      }
    })
    // The validated DTO's literal starting-equipment sources represent the authored string enum.
    const character = saved.payload.character as CharacterAuthored
    const first = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(first.registry.backgrounds.map((row) => row.id)).toEqual([authored.id])
    expect(first.vocabularySnapshot?.document).toEqual(srdSystemRecord)
    const output = evaluateInstalledCharacterPolicy({
      gameSystemId: character.systemId,
      facts: composeCharacterRulePolicyFacts({ character, context: ruleContext(first) }).facts
    })
    expect(output.proficiencies.filter((entry) => entry.kind === 'SKILL')).toHaveLength(2)
    const edited = await owner.caller.mutation(
      api.content.drafts.save,
      authoredDraftCommandInputSchema.parse({
        subjectKind: 'BACKGROUND',
        subjectId: authored.id,
        systemId: authored.systemId,
        label: 'Unpublished edit',
        payload: { ...authored, label: 'Unpublished edit', proficiencies: [] }
      })
    )
    const beforePublish = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(beforePublish.registry.backgrounds).toEqual(first.registry.backgrounds)
    expect(beforePublish.sourceIdentities).toEqual(first.sourceIdentities)
    if (!edited.updatedAt) throw new Error('Missing edited draft timestamp.')
    await owner.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'BACKGROUND',
      subjectId: authored.id,
      expectedDraftUpdatedAt: edited.updatedAt
    })
    const current = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(current.registry.backgrounds[0]?.label).toBe('Unpublished edit')
    expect(current.sourceIdentities[authored.id]?.versionId).not.toBe(
      first.sourceIdentities[authored.id]?.versionId
    )
    expect(
      evaluateInstalledCharacterPolicy({
        gameSystemId: character.systemId,
        facts: composeCharacterRulePolicyFacts({ character, context: ruleContext(current) }).facts
      }).proficiencies.filter((entry) => entry.kind === 'SKILL')
    ).toEqual([])
    expect(first.registry.backgrounds[0]?.label).toBe('Current background')
  }, 15_000)

  it('isolates owners and omits missing, foreign, wrong-kind and cross-System selections', async () => {
    const { t, owner, other } = await fixture()
    const foreign = background(other.userId, 'Private background')
    await publish(other.caller, 'BACKGROUND', foreign)
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    character.intent.background.backgroundId = foreign.id
    character.intent.race.raceId = foreign.id
    character.intent.classes = [{ classId: crypto.randomUUID(), classLevel: 1 }]
    const hidden = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(hidden.registry.backgrounds).toEqual([])
    expect(hidden.registry.races).toEqual([])
    expect(hidden.registry.classes).toEqual([])
    expect(hidden.sourceIdentities).toEqual({})
    await expect(t.run((ctx) => serializableContext(ctx, character, other.userId))).rejects.toThrow(
      'current user'
    )
    const owned = background(owner.userId, 'Other System')
    await publish(owner.caller, 'BACKGROUND', owned)
    character.intent.race.raceId = owned.id
    expect(
      (await t.run((ctx) => serializableContext(ctx, character, owner.userId))).registry.races
    ).toEqual([])
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', owned.id))
        .unique()
      if (!root) throw new Error('Missing source fixture.')
      await ctx.db.patch(root._id, { systemId: crypto.randomUUID() })
    })
    character.intent.background.backgroundId = owned.id
    expect(
      (await t.run((ctx) => serializableContext(ctx, character, owner.userId))).registry.backgrounds
    ).toEqual([])
  })

  it('loads only selected Class and Race roots with their exact current inheritance', async () => {
    const { t, owner } = await fixture()
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({ subjectKind: 'CLASS', ...fighter, document: fighter }),
        importedSubject({ subjectKind: 'RACE', ...elf, document: elf }),
        importedSubject({ subjectKind: 'RACE', ...highElf, document: highElf })
      ]
    })
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    character.intent.classes = [{ classId: fighter.id, classLevel: 1 }]
    character.intent.race = { raceId: elf.id, subraceId: highElf.id }
    const context = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(context.registry.classes.map((row) => row.id)).toEqual([fighter.id])
    expect(context.registry.races.map((row) => row.id)).toEqual([elf.id, highElf.id])
    expect(context.registry.races[1]?.category).toBe('SUBRACE')
    expect(
      context.registry.races[1]?.features?.some((row) => row.id === elf.features?.[0]?.id)
    ).toBe(true)
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', elf.id))
        .unique()
      if (!root) throw new Error('Missing Race parent fixture.')
      await ctx.db.patch(root._id, { ownerUserId: 'foreign-owner' })
    })
    await expect(t.run((ctx) => serializableContext(ctx, character, owner.userId))).rejects.toThrow(
      'readable base Race'
    )
  })

  it('requires a readable current base Class for a selected subclass', async () => {
    const { t, owner } = await fixture()
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [fighter, championMartialArchetype].map((document) =>
        importedSubject({ subjectKind: 'CLASS', ...document, document })
      )
    })
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    character.intent.classes = [
      { classId: fighter.id, subclassId: championMartialArchetype.id, classLevel: 3 }
    ]
    const context = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(context.registry.classes.map((row) => row.id)).toEqual([
      fighter.id,
      championMartialArchetype.id
    ])
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fighter.id))
        .unique()
      if (!root) throw new Error('Missing Class parent fixture.')
      await ctx.db.patch(root._id, { ownerUserId: 'foreign-owner' })
    })
    await expect(t.run((ctx) => serializableContext(ctx, character, owner.userId))).rejects.toThrow(
      'readable base class'
    )
  })

  it('loads chosen-grant Feat and Equipment targets only into their authorized registry kinds', async () => {
    const { t, owner, other } = await fixture()
    const feat = {
      id: crypto.randomUUID(),
      systemId: srdSystemRecord.id,
      userId: owner.userId,
      label: 'Chosen feat',
      description: '',
      features: []
    }
    const item = { ...club, id: crypto.randomUUID(), userId: owner.userId }
    const foreign = { ...feat, id: crypto.randomUUID(), userId: other.userId }
    await publish(owner.caller, 'FEAT', feat)
    await publish(owner.caller, 'EQUIPMENT', item)
    await publish(other.caller, 'FEAT', foreign)
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    character.intent.chosenGrantSelections = [
      {
        id: crypto.randomUUID(),
        grantId: crypto.randomUUID(),
        source: { kind: 'FEATURE', featureId: crypto.randomUUID() },
        timing: { kind: 'IMMEDIATE' },
        targetIds: [feat.id, item.id, foreign.id, crypto.randomUUID()]
      }
    ]
    const context = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(context.registry.feats?.map((row) => row.id)).toEqual([feat.id])
    expect(context.registry.equipment.map((row) => row.id)).toEqual([item.id])
    expect(context.registry.features).toEqual([])
    expect(character.state.equipment.inventory).toEqual([])
  })

  it('resolves selected Equipment from current parents without adding unowned inventory', async () => {
    const { t, owner } = await fixture()
    const base = { ...club, id: crypto.randomUUID(), userId: owner.userId, label: 'Owned base' }
    const variant = {
      ...clubPlus1,
      id: crypto.randomUUID(),
      parentEquipmentId: base.id,
      userId: owner.userId,
      label: 'Owned variant'
    }
    await publish(owner.caller, 'EQUIPMENT', base)
    await publish(owner.caller, 'EQUIPMENT', variant)
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    character.state.equipment.inventory = [
      { id: crypto.randomUUID(), equipmentId: variant.id, quantity: 1 }
    ]
    const before = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(before.registry.equipment.map((row) => row.id)).toEqual([variant.id])
    expect(Object.keys(before.sourceIdentities).sort()).toEqual([base.id, variant.id].sort())
    for (const identity of Object.values(before.sourceIdentities))
      expect(authoredCurrentSourceIdentitySchema.parse(identity)).toEqual(identity)
    await publish(owner.caller, 'EQUIPMENT', { ...base, weight: { amount: 9, unit: 'POUNDS' } })
    const after = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(after.registry.equipment[0]?.weight?.amount).toBe(9)
    expect(before.registry.equipment[0]?.weight?.amount).not.toBe(9)
    expect(after.sourceIdentities[variant.id]).toEqual(before.sourceIdentities[variant.id])
    expect(after.sourceIdentities[base.id]?.versionId).not.toBe(
      before.sourceIdentities[base.id]?.versionId
    )
    expect(after.sourceIdentities[base.id]?.checksum).not.toBe(
      before.sourceIdentities[base.id]?.checksum
    )
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', base.id))
        .unique()
      if (!root) throw new Error('Missing Equipment parent fixture.')
      await ctx.db.delete(root._id)
    })
    await expect(t.run((ctx) => serializableContext(ctx, character, owner.userId))).rejects.toThrow(
      'Readable parent Equipment'
    )
  })

  it('finds directly acquired current features through owner metadata without exposing foreign sources', async () => {
    const { t, owner, other } = await fixture()
    const ownFeature = {
      id: crypto.randomUUID(),
      label: 'Owned feature',
      description: '',
      order: 0
    }
    const foreignFeature = {
      id: crypto.randomUUID(),
      label: 'Private feature',
      description: '',
      order: 0
    }
    const own = { ...background(owner.userId, 'Feature owner'), features: [ownFeature] }
    await publish(owner.caller, 'BACKGROUND', own)
    await publish(other.caller, 'BACKGROUND', {
      ...background(other.userId, 'Foreign feature owner'),
      features: [foreignFeature]
    })
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    character.intent.featureAcquisitions = [ownFeature, foreignFeature].map((feature) => ({
      id: crypto.randomUUID(),
      featureId: feature.id,
      source: { kind: 'FEATURE', featureId: feature.id },
      timing: { kind: 'IMMEDIATE' }
    }))
    const context = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(context.registry.backgrounds).toEqual([])
    // D163: the registry holds the compiled Feature; its prose is read through the presentation lookup.
    expect(context.registry.features).toEqual([compileFeature(ownFeature)])
    expect(Object.values(context.presentation?.features ?? {})).toEqual([ownFeature])
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', own.id))
        .unique()
      const facts = root && (await readStoredSourceFacts(ctx, root))
      if (!root || !facts) throw new Error('Missing feature owner metadata.')
      await writeSourceFacts(ctx, root.id, { ...facts, checksum: '0'.repeat(64) })
    })
    await expect(t.run((ctx) => serializableContext(ctx, character, owner.userId))).rejects.toThrow(
      'authoring source checksum mismatch'
    )
  })

  it('loads published Spell summaries only when needed and retains exact authorized documents', async () => {
    const { t, owner, other } = await fixture()
    const platform = { ...light, effects: [] }
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'SPELL', ...platform, document: platform })]
    })
    const own = {
      ...platform,
      id: crypto.randomUUID(),
      label: 'Owned light',
      userId: owner.userId,
      classIds: []
    }
    const foreign = {
      ...own,
      id: crypto.randomUUID(),
      label: 'Private light',
      userId: other.userId
    }
    await publish(owner.caller, 'SPELL', own)
    await publish(other.caller, 'SPELL', foreign)
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    expect(
      (await t.run((ctx) => serializableContext(ctx, character, owner.userId))).catalog.spells
    ).toEqual([])
    character.intent.spellSelections = [
      {
        id: crypto.randomUUID(),
        source: { kind: 'FEATURE', featureId: crypto.randomUUID() },
        timing: { kind: 'IMMEDIATE' },
        spells: [light.id]
      }
    ]
    const context = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(context.catalog.spells.map((row) => row.id).sort()).toEqual([light.id, own.id].sort())
    expect(Object.keys(context.spellsById)).toEqual([light.id])
    expect(context.spellCatalogueEntries.map((row) => row.id).sort()).toEqual(
      [light.id, own.id].sort()
    )
    expect(context.spellsById[foreign.id]).toBeUndefined()
    expect(context.spellsById[light.id]?.classIds).toEqual(light.classIds)
    expect(context.sourceIdentities[own.id]?.checksum).toBeDefined()
    await t.run((ctx) => corruptPublishedVersionPayload(ctx, own.id))
    // Unused mechanics are not parsed; complete checksum-bound selection facts remain available.
    expect(
      (await t.run((ctx) => serializableContext(ctx, character, owner.userId))).catalog.spells
        .map((row) => row.id)
        .sort()
    ).toEqual([light.id, own.id].sort())
    character.intent.spellSelections[0]!.spells.push(own.id)
    await expect(
      t.run((ctx) => serializableContext(ctx, character, owner.userId))
    ).rejects.toThrow()
  })

  it('uses exact same-System platform and owned source choices, excluding foreign publications', async () => {
    const { t, owner, other } = await fixture()
    const platformSourceA = { ...SRD_CONTENT_SOURCE, id: crypto.randomUUID(), code: 'platform-a' }
    const platformSourceB = { ...SRD_CONTENT_SOURCE, id: crypto.randomUUID(), code: 'platform-b' }
    const orphanSource = { ...SRD_CONTENT_SOURCE, id: crypto.randomUUID(), code: 'orphan-platform' }
    await t.run(async (ctx) => {
      await ctx.db.insert('contentSources', platformSourceA)
      await ctx.db.insert('contentSources', platformSourceB)
      await ctx.db.insert('contentSources', orphanSource)
      await ctx.db.insert('rulesCatalogues', {
        ...SRD_RULES_CATALOGUE,
        id: crypto.randomUUID(),
        code: 'catalogue-a',
        contentSourceIds: [platformSourceA.id]
      })
      await ctx.db.insert('rulesCatalogues', {
        ...SRD_RULES_CATALOGUE,
        id: crypto.randomUUID(),
        code: 'catalogue-b',
        contentSourceIds: [platformSourceB.id]
      })
    })
    const platformClass = { ...fighter, id: crypto.randomUUID(), label: 'Platform A class' }
    const platformRace = { ...elf, id: crypto.randomUUID(), label: 'Platform B race' }
    const orphanClass = { ...fighter, id: crypto.randomUUID(), label: 'Orphan platform class' }
    await importSeededSubjects(t, {
      contentSourceId: platformSourceA.id,
      subjects: [
        importedSubject({ subjectKind: 'CLASS', ...platformClass, document: platformClass })
      ]
    })
    await importSeededSubjects(t, {
      contentSourceId: platformSourceB.id,
      subjects: [importedSubject({ subjectKind: 'RACE', ...platformRace, document: platformRace })]
    })
    await importSeededSubjects(t, {
      contentSourceId: orphanSource.id,
      subjects: [importedSubject({ subjectKind: 'CLASS', ...orphanClass, document: orphanClass })]
    })
    const homebrew = background(owner.userId, 'Owned homebrew')
    const foreign = background(other.userId, 'Foreign publication')
    await publish(owner.caller, 'BACKGROUND', homebrew)
    await publish(other.caller, 'BACKGROUND', foreign)
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    character.intent.classes = [
      { classId: platformClass.id, classLevel: 1 },
      { classId: orphanClass.id, classLevel: 1 }
    ]
    character.intent.race.raceId = platformRace.id
    character.intent.background.backgroundId = homebrew.id
    const context = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(context.registry.classes.map((row) => row.id)).toEqual([platformClass.id])
    expect(context.registry.races.map((row) => row.id)).toEqual([platformRace.id])
    expect(context.registry.backgrounds.map((row) => row.id)).toEqual([homebrew.id])
    const catalog = await t.run(
      async (ctx) =>
        (await loadCharacterBuilderContext(ctx, character, owner.userId, 'resolution')).catalog
    )
    expect(catalog.classes.map((row) => row.id)).toContain(platformClass.id)
    expect(catalog.classes.map((row) => row.id)).not.toContain(orphanClass.id)
    character.intent.background.backgroundId = foreign.id
    const foreignContext = await t.run((ctx) => serializableContext(ctx, character, owner.userId))
    expect(foreignContext.registry.backgrounds).toEqual([])

    const orphanChild = {
      ...championMartialArchetype,
      id: crypto.randomUUID(),
      parentClassId: orphanClass.id
    }
    await importSeededSubjects(t, {
      contentSourceId: platformSourceA.id,
      subjects: [importedSubject({ subjectKind: 'CLASS', ...orphanChild, document: orphanChild })]
    })
    character.intent.classes = [
      { classId: orphanClass.id, subclassId: orphanChild.id, classLevel: 3 }
    ]
    await expect(t.run((ctx) => serializableContext(ctx, character, owner.userId))).rejects.toThrow(
      'readable base class'
    )
  })

  it('fails closed on unavailable System and current-document corruption', async () => {
    const { t, owner } = await fixture()
    const owned = background(owner.userId, 'Checked source')
    await publish(owner.caller, 'BACKGROUND', owned)
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    character.intent.background.backgroundId = owned.id
    await expect(
      t.run((ctx) =>
        serializableContext(
          ctx,
          {
            ...character,
            systemId: crypto.randomUUID()
          },
          owner.userId
        )
      )
    ).rejects.toThrow('Game System is unavailable')
    await t.run(async (ctx) => {
      await corruptPublishedVersionPayload(ctx, owned.id)
    })
    await expect(t.run((ctx) => serializableContext(ctx, character, owner.userId))).rejects.toThrow(
      'checksum mismatch'
    )
  })
})
