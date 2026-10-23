import { describe, expect, it } from 'vitest'
import { snapshotStatBlock } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { greatclub } from '@artificer-toolkit/source-data/srd/equipment/greatclub.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { creaturePublicationInput } from '../../tests/fixtures/creatureDrafts'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import {
  importSeededSrdCreatureSenses,
  seededSrdCreature,
  seededSrdPinnedSources,
  srdPrintedArmorClass
} from '../../tests/fixtures/srdCreatures'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { api, internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'

const goblin = seededSrdCreature('Goblin')

async function setup() {
  const base = await fixture()
  await importSeededSrdCreatureSenses(base.t, goblin)
  // Nimble Escape offers Disengage and Hide, which a copy of the Goblin keeps only while they exist.
  for (const definitions of sourceImportBatches(SRD_BASIC_ACTION_DEFINITIONS))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...goblin, subjectKind: 'CREATURE', document: goblin }),
      ...seededSrdPinnedSources(goblin).map(importedSubject),
      importedSubject({ ...greatclub, subjectKind: 'EQUIPMENT', document: greatclub })
    ]
  })
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, {
    name: 'Creature edit',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  return { ...base, campaign }
}

describe('editing a Creature and its Encounter armor class', () => {
  it('reaches a new Run through the Blueprint while a Run already created keeps its pinned armor class', async () => {
    const { t, owner, campaign } = await setup()
    const { caller } = owner
    const publish = (draft: Parameters<typeof creaturePublicationInput>[0]) =>
      caller.mutation(api.content.publication.publishDraft, creaturePublicationInput(draft))
    const armorClassOf = (encounterId: string, actorId: string) =>
      t.run(async (ctx) => {
        const row = await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', actorId))
          .unique()
        if (!row) throw new Error('Missing Encounter actor.')
        return snapshotStatBlock(await readTestActor(ctx, row))?.armorClass
      })
    const createRun = async (blueprintId: string) => {
      const run = await caller.mutation(api.encounters.runs.create, {
        campaignId: campaign.id,
        blueprintId,
        commandId: crypto.randomUUID()
      })
      const actor = run.actors.find((candidate) => candidate.kind === 'CREATURE')
      if (!actor) throw new Error('Missing Creature actor.')
      return { runId: run.id, actorId: actor.id }
    }
    const currentChecksumOf = async (subjectId: string) =>
      t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', subjectId))
          .unique()
        if (!root) throw new Error('Missing Creature root.')
        return root.checksum
      })

    // The author copies the SRD Goblin and publishes it as their own.
    const draft = await caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CREATURE',
      subjectId: goblin.id
    })
    const copied = creatureAuthoredDtoSchema.parse(draft.payload)
    const shieldEntry = copied.equipmentLoadout?.find(
      (entry) => entry.equipmentId === shieldWood.id
    )
    if (!shieldEntry) throw new Error('The Goblin copy holds no shield.')
    expect(shieldEntry.useState).toBe('OFF_HAND')
    const published = await publish(draft)
    const publishedChecksum = await currentChecksumOf(draft.subjectId)
    expect(publishedChecksum).toBe(published.checksum)

    // The GM pins that Creature in a Blueprint and starts a Run: leather 11 + Dex 2 + shield 2.
    const blueprint = await caller.mutation(api.encounters.blueprints.create, {
      gameSystemId: campaign.gameSystemId,
      name: 'Goblin ambush',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CREATURE', sourceId: draft.subjectId }]
    })
    const first = await createRun(blueprint.id)
    const printedArmorClass = srdPrintedArmorClass(goblin)
    expect(printedArmorClass).toBe(15)
    expect(await armorClassOf(first.runId, first.actorId)).toBe(printedArmorClass)

    // A two-handed main-hand weapon beside the shield is refused and leaves the Creature as published.
    const crowded = await caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: draft.label,
      payload: {
        ...copied,
        equipmentLoadout: [
          ...(copied.equipmentLoadout ?? []).map((entry) =>
            entry.useState === 'MAIN_HAND' ? { ...entry, useState: 'CARRIED' as const } : entry
          ),
          {
            id: crypto.randomUUID(),
            equipmentId: greatclub.id,
            quantity: 1,
            useState: 'MAIN_HAND' as const,
            attuned: false,
            actionFeatureIds: []
          }
        ]
      }
    })
    await expect(publish(crowded)).rejects.toThrow(
      'A two-handed main-hand item blocks the off hand.'
    )
    expect(await currentChecksumOf(draft.subjectId)).toBe(publishedChecksum)

    // The author moves the shield out of the hand and adds a natural armor bonus, then republishes.
    const edited = await caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: draft.label,
      payload: {
        ...copied,
        naturalArmorBonus: 1,
        equipmentLoadout: copied.equipmentLoadout?.map((entry) =>
          entry.id === shieldEntry.id ? { ...entry, useState: 'CARRIED' as const } : entry
        )
      }
    })
    const republished = await publish(edited)
    expect(await currentChecksumOf(draft.subjectId)).toBe(republished.checksum)
    expect(republished.checksum).not.toBe(publishedChecksum)

    // The Run already created and a Run from the not-yet-updated Blueprint keep the pinned Creature.
    expect(await armorClassOf(first.runId, first.actorId)).toBe(printedArmorClass)
    const stale = await createRun(blueprint.id)
    expect(await armorClassOf(stale.runId, stale.actorId)).toBe(printedArmorClass)

    // Updating the Blueprint re-pins the edited Creature: leather 11 + Dex 2 + natural 1, no shield.
    await caller.mutation(api.encounters.blueprints.update, {
      blueprintId: blueprint.id,
      expectedVersion: blueprint.version,
      commandId: crypto.randomUUID(),
      name: blueprint.name,
      enemies: [{ kind: 'CREATURE', sourceId: draft.subjectId }]
    })
    const second = await createRun(blueprint.id)
    expect(await armorClassOf(second.runId, second.actorId)).toBe(14)
    expect(await armorClassOf(first.runId, first.actorId)).toBe(printedArmorClass)
  }, 60000)
})
