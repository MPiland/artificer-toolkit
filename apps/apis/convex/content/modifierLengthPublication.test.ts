import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { druid } from '@artificer-toolkit/source-data/srd/classes/druid.js'
import { ranger } from '@artificer-toolkit/source-data/srd/classes/ranger.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { longstrider } from '@artificer-toolkit/source-data/srd/spells/longstrider.js'
import { AUTHORED_LENGTH_AMOUNT_MAX } from '@artificer-toolkit/schema/shared/authoredLimits'
import {
  authoredPublishDraftInputSchema,
  type AuthoredPublicationResult,
  type AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { api } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'

const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [importedSubject({ subjectKind: 'SPELL', ...longstrider, document: longstrider })],
      [bard, druid].map((klass) =>
        importedSubject({ subjectKind: 'CLASS', ...klass, document: klass })
      ),
      [ranger, wizard].map((klass) =>
        importedSubject({ subjectKind: 'CLASS', ...klass, document: klass })
      )
    ]
  )
}

function publicationInput(draft: AuthoredDraftResult): AuthoredPublishDraftInput {
  if (!draft.updatedAt) throw new Error('Missing Spell draft revision')
  return authoredPublishDraftInputSchema.parse({
    subjectKind: 'SPELL',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

/** Replaces the payload of every modifier grant in an authored document. */
function withModifierPayload<T>(value: T, payload: unknown): T {
  if (Array.isArray(value)) return value.map((entry) => withModifierPayload(entry, payload)) as T
  if (typeof value !== 'object' || value === null) return value
  const entry = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, withModifierPayload(child, payload)])
  )
  return (entry.grantKind === 'MODIFIER_GRANT' ? { ...entry, payload } : entry) as T
}

/** The payload of every modifier grant in an authored document. */
function modifierPayloads(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(modifierPayloads)
  if (typeof value !== 'object' || value === null) return []
  const entry = value as Record<string, unknown>
  return [
    ...(entry.grantKind === 'MODIFIER_GRANT' ? [entry.payload] : []),
    ...Object.values(entry).flatMap(modifierPayloads)
  ]
}

describe('native Spell publication of speed modifier lengths (RELIABILITY-5.1)', () => {
  it('publishes a speed bonus authored as a length and refuses one that is not', async () => {
    const { first } = await fixture()
    const draft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'SPELL',
      subjectId: longstrider.id
    })
    const saveAndPublish = async (payload: unknown) =>
      first.caller.mutation(
        publish,
        publicationInput(
          await first.caller.mutation(api.content.drafts.save, {
            subjectKind: 'SPELL',
            subjectId: draft.subjectId,
            systemId: draft.systemId,
            label: 'Homebrew Longstrider',
            payload: withModifierPayload(draft.payload, payload)
          })
        )
      )

    // The refusal is a JSON dump of every modifier-grant union branch, so each case asserts the
    // exact issue message of the length field it breaks, escaped as it appears in that dump.
    const issue = (message: string) => JSON.stringify(message).slice(1, -1)
    const unitRefusal = issue('Invalid option: expected one of "INCHES"|"FEET"|"YARDS"|"MILES"')
    for (const { payload, message } of [
      { payload: { amount: 30 }, message: unitRefusal },
      { payload: { amount: 30, unit: 'FURLONGS' }, message: unitRefusal },
      { payload: { amount: 30, unit: 'feet' }, message: unitRefusal },
      {
        payload: { amount: AUTHORED_LENGTH_AMOUNT_MAX + 1, unit: 'FEET' },
        message: issue(`Too big: expected number to be <=${AUTHORED_LENGTH_AMOUNT_MAX}`)
      },
      {
        payload: { amount: -5, unit: 'FEET' },
        message: issue('Too small: expected number to be >=0')
      },
      { payload: { valueKind: 'FIXED', amount: 10 }, message: unitRefusal }
    ])
      await expect.soft(saveAndPublish(payload), JSON.stringify(payload)).rejects.toThrow(message)

    await saveAndPublish({ amount: 30, unit: 'FEET' })
    const detail = await first.caller.query(api.content.exports.get, {
      subjectKind: 'SPELL',
      id: draft.publicId,
      view: 'active'
    })
    expect(modifierPayloads(detail.item)).toEqual([{ amount: 30, unit: 'FEET' }])
  })
})
