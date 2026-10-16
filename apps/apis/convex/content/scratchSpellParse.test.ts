import { describe, expect, it } from 'vitest'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { thunderwave } from '@artificer-toolkit/source-data/srd/spells/thunderwave.js'
import { api } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { createPlayerJourneyWolf } from '../../tests/fixtures/encounterPlayer'

function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({ subjectKind: 'SPELL', ...shield, document: shield }),
        importedSubject({ subjectKind: 'SPELL', ...thunderwave, document: thunderwave })
      ],
      [importedSubject({ subjectKind: 'CLASS', ...wizard, document: wizard })]
    ]
  )
}

describe('scratch copy path', () => {
  for (const spell of [shield, thunderwave]) {
    it(`duplicates, saves and publishes ${spell.label}`, async () => {
      const { first } = await fixture()
      const copied = await first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: 'SPELL',
        subjectId: spell.id
      })
      const saved = await first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'SPELL',
        subjectId: copied.subjectId,
        systemId: copied.systemId,
        label: spell.label,
        payload: { ...copied.payload, label: spell.label, classIds: [wizard.id] }
      })
      expect(saved.updatedAt).toBeTruthy()
      await first.caller.mutation(api.content.publication.publishDraft, {
        subjectKind: 'SPELL',
        subjectId: copied.subjectId,
        expectedDraftUpdatedAt: saved.updatedAt as string
      })
    })
  }

  it('saves and publishes the 200-hit-point journey Wolf', async () => {
    const { first } = await fixture()
    const wolf = createPlayerJourneyWolf(crypto.randomUUID(), 'Journey wolf')
    const saved = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: wolf.id,
      systemId: wolf.systemId,
      label: wolf.label,
      payload: wolf
    })
    expect(saved.updatedAt).toBeTruthy()
    await first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'CREATURE',
      subjectId: saved.subjectId,
      expectedDraftUpdatedAt: saved.updatedAt as string
    })
  })
})
