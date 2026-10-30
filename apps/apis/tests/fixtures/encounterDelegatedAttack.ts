import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { findFamiliar } from '@artificer-toolkit/source-data/srd/spells/find-familiar.js'

/**
 * Pact of the Chain's grants as a Feature gained at 1st level, naming the summon of the Character's
 * own Find Familiar copy.
 */
export function createDelegatedAttackFeatures(copies: ReadonlyMap<string, AuthoredDraftResult>) {
  const pact = warlock.features
    ?.flatMap((feature) => feature.options ?? [])
    .find((option) => option.label === 'Pact of the Chain')
  const effectId = spellAuthoredDtoSchema.parse(copies.get(findFamiliar.id)?.payload).effects?.[0]
    ?.id
  if (!pact || !effectId) throw new Error('The delegated attack needs its grant and its summon.')
  return [
    {
      id: crypto.randomUUID(),
      label: pact.label,
      description: pact.description,
      availableAtLevel: 1,
      order: 90,
      grants: {
        modifiers: (pact.grants?.modifiers ?? []).map((modifier) => ({
          ...modifier,
          id: crypto.randomUUID(),
          payload: { effectIds: [effectId] }
        }))
      }
    }
  ]
}
