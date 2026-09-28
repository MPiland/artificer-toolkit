import { describe, expect, it } from 'vitest'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { retainCharacterEquipmentRules } from './acquiredEquipment'
import { CharacterStartingEquipmentSource } from '@artificer-toolkit/shared/subjects/authored'
import { authoredDraftCommandInputSchema } from '@artificer-toolkit/schema/api/authoredDrafts'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { fixture, input } from '../../tests/fixtures/characters'
import { importedSubject } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { readCharacterSourceAccessLoss } from './sourceAccessLoss'
import { readCharacterDraft } from './documents'
import {
  reconcileCharacterSourceLoss,
  reconcileCreateOnlyCharacterDraftSourceLoss
} from './sourceLoss'

async function publishFeat(
  actor: Awaited<ReturnType<typeof fixture>>['owner'],
  id: string,
  grants?: FeatAuthoredDto['grants']
) {
  const document = {
    id,
    label: `Authored feat ${id}`,
    description: '',
    systemId: srdSystemRecord.id,
    userId: actor.userId,
    features: [],
    ...(grants ? { grants } : {})
  }
  const draft = await actor.caller.mutation(
    api.content.drafts.save,
    authoredDraftCommandInputSchema.parse({
      subjectKind: 'FEAT',
      subjectId: id,
      systemId: srdSystemRecord.id,
      label: document.label,
      payload: document
    })
  )
  if (!draft.updatedAt) throw new Error('Missing draft timestamp.')
  await actor.caller.mutation(api.content.publication.publishDraft, {
    subjectKind: 'FEAT',
    subjectId: id,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

describe('Character authored source access loss', () => {
  it('retains held raw Equipment without author access while fencing new choices and corrupt rules', async () => {
    const { t, owner, other } = await fixture()
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({
          subjectKind: 'EQUIPMENT',
          ...backpack,
          document: backpack
        })
      ]
    })
    const draft = await other.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: backpack.id
    })
    if (!draft.updatedAt) throw new Error('Equipment draft timestamp is missing.')
    const publication = await other.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'EQUIPMENT',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
    const character = createEmptyCharacterAuthored({
      ...input(),
      userId: owner.userId
    })
    character.state.equipment.inventory = [
      {
        id: crypto.randomUUID(),
        equipmentId: publication.subjectId,
        quantity: 1
      }
    ]
    const loss = [{ subjectKind: 'EQUIPMENT', subjectId: publication.subjectId }]
    expect(
      await t.run((ctx) =>
        readCharacterSourceAccessLoss(ctx, character, {
          allowRetainedEquipment: true
        })
      )
    ).toEqual(loss)
    const captured = await t.run((ctx) =>
      retainCharacterEquipmentRules(ctx, {
        ...character,
        userId: other.userId
      })
    )
    character.state = captured
    const held = character.state.equipment.inventory[0]
    if (!held?.retainedRulesJson) throw new Error('Actual captured Equipment rules are missing.')
    const before = structuredClone(character)
    expect(await t.run((ctx) => readCharacterSourceAccessLoss(ctx, character))).toEqual(loss)
    expect(
      await t.run((ctx) =>
        readCharacterSourceAccessLoss(ctx, character, {
          allowRetainedEquipment: true
        })
      )
    ).toEqual([])
    expect(character).toEqual(before)
    character.intent.startingEquipment = {
      class: {
        source: CharacterStartingEquipmentSource.CLASS,
        tookGold: false,
        groups: [
          {
            groupId: crypto.randomUUID(),
            optionId: crypto.randomUUID(),
            selections: [
              {
                selectionKey: 'new-selection',
                equipmentId: publication.subjectId,
                quantity: 1
              }
            ]
          }
        ]
      }
    }
    expect(
      await t.run((ctx) =>
        readCharacterSourceAccessLoss(ctx, character, {
          allowRetainedEquipment: true
        })
      )
    ).toEqual(loss)
    delete character.intent.startingEquipment
    const raw = acquiredEquipmentRulesSchema.parse(JSON.parse(held.retainedRulesJson))
    held.retainedRulesJson = JSON.stringify({
      ...raw,
      equipmentId: crypto.randomUUID()
    })
    await expect(
      t.run((ctx) =>
        readCharacterSourceAccessLoss(ctx, character, {
          allowRetainedEquipment: true
        })
      )
    ).rejects.toThrow('Acquired Equipment scope mismatch')
    held.retainedRulesJson = JSON.stringify({
      ...raw,
      systemId: crypto.randomUUID()
    })
    await expect(
      t.run((ctx) =>
        readCharacterSourceAccessLoss(ctx, character, {
          allowRetainedEquipment: true
        })
      )
    ).rejects.toThrow('Acquired Equipment scope mismatch')
    const source = raw.sources[0]
    if (!source) throw new Error('Captured Equipment source is missing.')
    const document: Record<string, unknown> = JSON.parse(source.documentJson)
    held.retainedRulesJson = JSON.stringify({
      ...raw,
      sources: [
        {
          ...source,
          documentJson: JSON.stringify({
            ...document,
            label: 'Corrupt captured rules'
          })
        },
        ...raw.sources.slice(1)
      ]
    })
    await expect(
      t.run((ctx) =>
        readCharacterSourceAccessLoss(ctx, character, {
          allowRetainedEquipment: true
        })
      )
    ).rejects.toThrow('Acquired source checksum mismatch')
    held.retainedRulesJson = before.state.equipment.inventory[0]!.retainedRulesJson
    expect(character).toEqual(before)
    expect(
      await t.run((ctx) =>
        readCharacterSourceAccessLoss(ctx, character, {
          allowRetainedEquipment: true
        })
      )
    ).toEqual([])
  })

  it('ignores foreign roots colliding with language choices and embedded feature options', async () => {
    const { t, owner, other } = await fixture()
    const vocabulary = {
      ...srdSystemRecord,
      languages: srdSystemRecord.languages.map((language, index) =>
        index === 0 ? { ...language, id: crypto.randomUUID() } : language
      )
    }
    await t.run(async (ctx) => {
      const system = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', vocabulary.id))
        .unique()
      if (!system) throw new Error('Missing System fixture.')
      const document = JSON.parse(JSON.stringify(vocabulary))
      await ctx.db.patch(system._id, {
        document,
        checksum: checksumRuleDocument(document)
      })
    })
    const background = {
      ...acolyte,
      features: [],
      startingEquipment: undefined,
      proficiencies: acolyte.proficiencies?.map((grant) =>
        grant.proficiencyKind === 'LANGUAGE'
          ? {
              ...grant,
              languageIds: vocabulary.languages.map((language) => language.id)
            }
          : grant
      )
    }
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({
          subjectKind: 'BACKGROUND',
          ...background,
          document: background
        })
      ]
    })
    const languages = vocabulary.languages.slice(0, 2).map((language) => language.id)
    const optionId = crypto.randomUUID()
    await publishFeat(other, languages[0]!)
    await publishFeat(other, optionId)
    const languageGrant = background.proficiencies?.find(
      (grant) => grant.proficiencyKind === 'LANGUAGE'
    )
    if (!languageGrant) throw new Error('Missing language grant.')
    const character = createEmptyCharacterAuthored({
      ...input(),
      userId: owner.userId
    })
    character.intent.background.backgroundId = background.id
    character.intent.chosenGrantSelections = [
      {
        id: crypto.randomUUID(),
        grantId: languageGrant.id,
        source: { kind: 'BACKGROUND', backgroundId: background.id },
        timing: { kind: 'IMMEDIATE' },
        targetIds: languages
      }
    ]
    character.intent.featureAcquisitions = [
      {
        id: crypto.randomUUID(),
        featureId: crypto.randomUUID(),
        source: { kind: 'MANUAL' },
        timing: { kind: 'IMMEDIATE' },
        selections: [
          {
            selectionKey: 'options',
            values: [{ kind: 'IDS', ids: [optionId] }]
          }
        ]
      }
    ]
    const before = structuredClone(character)
    expect(await t.run((ctx) => readCharacterSourceAccessLoss(ctx, character))).toEqual([])
    expect(character).toEqual(before)

    const opened = await owner.caller.mutation(api.characters.drafts.create, {
      id: character.id,
      systemId: character.systemId
    })
    await owner.caller.mutation(api.characters.drafts.save, {
      characterId: character.id,
      expectedDraftId: opened.id,
      mode: 'create',
      character: JSON.parse(JSON.stringify(character))
    })
    await t.run(async (ctx) => {
      const draft = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
        .unique()
      if (!draft) throw new Error('Missing Character draft.')
      const result = await reconcileCreateOnlyCharacterDraftSourceLoss({
        ctx,
        draft,
        targets: [
          { subjectKind: 'FEAT', subjectId: languages[0]! },
          { subjectKind: 'FEAT', subjectId: optionId }
        ]
      })
      expect(result).toBeNull()
      expect(await ctx.db.get(draft._id)).toEqual(draft)
    })
  })

  it.each(['create-only', 'canonical-and-edit-draft'] as const)(
    'prunes an authored Feat choice but preserves colliding feature options in %s',
    async (mode) => {
      const { t, owner, other } = await fixture()
      const ownerFeatId = crypto.randomUUID()
      const foreignFeatId = crypto.randomUUID()
      const grantId = crypto.randomUUID()
      await publishFeat(other, foreignFeatId)
      const grants: FeatAuthoredDto['grants'] = {
        feats: [
          {
            id: grantId,
            grantKind: 'FEAT_GRANT',
            selectionKind: 'CHOSEN',
            selectionDuplicatePolicy: 'UNIQUE',
            scalingKind: 'NONE',
            authoringModeKind: 'ALL',
            count: 1,
            order: 0
          }
        ]
      }
      await publishFeat(owner, ownerFeatId, grants)
      const character = createEmptyCharacterAuthored({
        ...input(),
        userId: owner.userId
      })
      character.intent.featureAcquisitions = [
        {
          id: crypto.randomUUID(),
          featureId: ownerFeatId,
          source: { kind: 'FEAT', featId: ownerFeatId },
          timing: { kind: 'IMMEDIATE' },
          selections: [
            {
              selectionKey: 'options',
              values: [{ kind: 'IDS', ids: [foreignFeatId] }]
            }
          ]
        }
      ]
      character.intent.chosenGrantSelections = [
        {
          id: crypto.randomUUID(),
          grantId,
          source: { kind: 'FEAT', featId: ownerFeatId },
          timing: { kind: 'IMMEDIATE' },
          targetIds: [foreignFeatId]
        }
      ]
      expect(await t.run((ctx) => readCharacterSourceAccessLoss(ctx, character))).toEqual([
        { subjectKind: 'FEAT', subjectId: foreignFeatId }
      ])
      const savedCharacter = structuredClone(character)
      savedCharacter.label = 'Private draft label'
      if (mode === 'canonical-and-edit-draft') {
        const draftOwnerId = crypto.randomUUID()
        await publishFeat(owner, draftOwnerId, grants)
        savedCharacter.intent.featureAcquisitions = savedCharacter.intent.featureAcquisitions.map(
          (entry) => ({
            ...entry,
            featureId: draftOwnerId,
            source: { kind: 'FEAT', featId: draftOwnerId }
          })
        )
        savedCharacter.intent.chosenGrantSelections =
          savedCharacter.intent.chosenGrantSelections?.map((entry) => ({
            ...entry,
            source: { kind: 'FEAT', featId: draftOwnerId }
          }))
      }
      const opened = await owner.caller.mutation(api.characters.drafts.create, {
        id: character.id,
        systemId: character.systemId
      })
      await owner.caller.mutation(api.characters.drafts.save, {
        characterId: character.id,
        expectedDraftId: opened.id,
        mode: 'create',
        character: characterAuthoredDtoSchema.parse(JSON.parse(JSON.stringify(savedCharacter)))
      })
      await t.run(async (ctx) => {
        const draft = await ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique()
        if (!draft) throw new Error('Missing Character draft.')
        const targets = [{ subjectKind: 'FEAT' as const, subjectId: foreignFeatId }]
        if (mode === 'create-only') {
          expect(
            await reconcileCreateOnlyCharacterDraftSourceLoss({
              ctx,
              draft,
              targets
            })
          ).toEqual(targets)
        } else {
          const encoded = JSON.parse(JSON.stringify(character))
          const now = new Date().toISOString()
          const id = await ctx.db.insert('characters', {
            id: character.id,
            userId: character.userId,
            systemId: character.systemId,
            label: character.label,
            status: 'DRAFT',
            streamVersion: 1,
            createdAt: now,
            updatedAt: now,
            documentJson: JSON.stringify(encoded),
            checksum: checksumRuleDocument(encoded),
            maximumHitPoints: 0,
            walkingSpeed: 0
          })
          await ctx.db.patch(draft._id, {
            mode: 'edit',
            baseActiveUpdatedAt: now
          })
          const record = await ctx.db.get(id)
          if (!record) throw new Error('Missing canonical Character.')
          expect(await reconcileCharacterSourceLoss({ ctx, record, targets })).toMatchObject({
            removedSources: targets,
            status: 'DRAFT',
            draftOnly: false,
            streamVersion: 2
          })
          const after = await ctx.db.get(id)
          if (!after) throw new Error('Missing reconciled Character.')
          const pruned = characterAuthoredDtoSchema.parse(JSON.parse(after.documentJson))
          expect(pruned.intent.chosenGrantSelections).toBeUndefined()
          expect(pruned.intent.featureAcquisitions).toEqual(character.intent.featureAcquisitions)
          expect(await reconcileCharacterSourceLoss({ ctx, record: after, targets })).toBeNull()
        }
        const afterDraft = await ctx.db.get(draft._id)
        if (!afterDraft) throw new Error('Missing reconciled draft.')
        // The payload document is replaced in place.
        expect(afterDraft.payloadDocumentId).toBe(draft.payloadDocumentId)
        expect(afterDraft.payloadId).not.toBe(draft.payloadId)
        const active = await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', afterDraft.characterId))
          .unique()
        const payload = (await readCharacterDraft(ctx, afterDraft, active)).payload
        expect(payload.character.label).toBe(savedCharacter.label)
        expect(payload.character.intent.chosenGrantSelections).toBeUndefined()
        expect(payload.character.intent.featureAcquisitions).toEqual(
          savedCharacter.intent.featureAcquisitions
        )
      })
    }
  )
})
