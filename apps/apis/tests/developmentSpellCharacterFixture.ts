import assert from 'node:assert/strict'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { detectMagic } from '@artificer-toolkit/source-data/srd/spells/detect-magic.js'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'
import { createDevelopmentCharacter } from './developmentCharacterFixture'
import type { DevelopmentClient } from './developmentClient'

export async function createDevelopmentSpellCharacter(
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>,
  characterId: string,
  spells: readonly Pick<typeof shield, 'id' | 'label'>[] = [magicMissile, shield, detectMagic],
  slots: readonly { spellLevel: number; slotCount: number }[] = [{ spellLevel: 1, slotCount: 2 }],
  /** The Class's Features, read off the spell copies: a copy's authored ids are its own. */
  features?: (
    copies: ReadonlyMap<string, AuthoredDraftResult>
  ) => NonNullable<Parameters<typeof createDevelopmentCharacter>[2]>['features'],
  /** Rewrites each spell copy's payload before it is saved and published. */
  amendSpell: (payload: AuthoredDraftResult['payload']) => AuthoredDraftResult['payload'] = (
    payload
  ) => payload
) {
  assert.ok(wizard.spellcasting)
  const copies = new Map<string, AuthoredDraftResult>()
  for (const spell of spells)
    copies.set(
      spell.id,
      await owner.mutation(api.content.drafts.duplicate, {
        subjectKind: 'SPELL',
        subjectId: spell.id
      })
    )
  const result = await createDevelopmentCharacter(owner, characterId, {
    spellcasting: {
      ...wizard.spellcasting,
      attributes: ['PREPARES_SPELLS', 'USES_SPELLBOOK'],
      spellLimits: [{ classLevel: 1, slots: [...slots], cantripsLimit: 0 }]
    },
    ...(features ? { features: features(copies) } : {})
  })
  const classId = result.character.intent.classes[0]?.classId
  if (!classId) throw new Error('Spell fixture Character must retain its Class identity.')
  const spellSubjectIds = new Map<string, string>()
  for (const spell of spells) {
    const copied = copies.get(spell.id)
    if (!copied) throw new Error('Spell fixture lost its copy.')
    const saved = await owner.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: copied.subjectId,
      systemId: copied.systemId,
      label: spell.label,
      payload: amendSpell({ ...copied.payload, label: spell.label, classIds: [classId] })
    })
    if (!saved.updatedAt) throw new Error('Spell fixture draft save did not return its revision.')
    await owner.mutation(api.content.publication.publishDraft, {
      subjectKind: 'SPELL',
      subjectId: copied.subjectId,
      expectedDraftUpdatedAt: saved.updatedAt
    })
    spellSubjectIds.set(spell.id, copied.subjectId)
  }
  return { ...result, classId, spellSubjectIds }
}
