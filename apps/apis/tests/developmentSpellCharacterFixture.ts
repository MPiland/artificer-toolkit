import assert from 'node:assert/strict'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { detectMagic } from '@artificer-toolkit/source-data/srd/spells/detect-magic.js'
import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'
import { createDevelopmentCharacter } from './developmentCharacterFixture'
import type { DevelopmentClient } from './developmentClient'

export async function createDevelopmentSpellCharacter(
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>,
  characterId: string
) {
  assert.ok(wizard.spellcasting)
  const result = await createDevelopmentCharacter(owner, characterId, {
    spellcasting: {
      ...wizard.spellcasting,
      attributes: ['PREPARES_SPELLS', 'USES_SPELLBOOK'],
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 0 }]
    }
  })
  const classId = result.character.intent.classes[0]?.classId
  if (!classId) throw new Error('Spell fixture Character must retain its Class identity.')
  for (const spell of [magicMissile, shield, detectMagic]) {
    const copied = await owner.mutation(api.content.drafts.duplicate, {
      subjectKind: 'SPELL',
      subjectId: spell.id
    })
    const saved = await owner.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: copied.subjectId,
      systemId: copied.systemId,
      label: spell.label,
      payload: { ...copied.payload, label: spell.label, classIds: [classId] }
    })
    if (!saved.updatedAt) throw new Error('Spell fixture draft save did not return its revision.')
    await owner.mutation(api.content.publication.publishDraft, {
      subjectKind: 'SPELL',
      subjectId: copied.subjectId,
      expectedDraftUpdatedAt: saved.updatedAt
    })
  }
  return result
}
