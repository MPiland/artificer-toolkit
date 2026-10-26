import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterRestPreviewInput,
  CharacterRestPreviewResponseDto,
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import type { PathLifecycleReturnsOn } from '@artificer-toolkit/shared/core'
import {
  STANDING_WARD_EFFECT_ID,
  standingWardFeature
} from '@artificer-toolkit/rules-runtime/testing/standingWardFeature'
import { api } from '../_generated/api'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const preview = makeFunctionReference<
  'query',
  CharacterRestPreviewInput,
  CharacterRestPreviewResponseDto
>('characters/rest:preview')

/** SPELLS-31.2: the Sheet rest a Character's standing effect returns on turns it back on. */
describe('Sheet rest and standing effects', () => {
  async function fixture(returnsOn: PathLifecycleReturnsOn) {
    const base = await readyCharacterFixture({ features: [standingWardFeature(returnsOn)] })
    const { draft, character } = await base.createCharacter()
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const owner = { kind: 'CHARACTER' as const, characterId: character.id }
    const effects = () =>
      base.t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).list(owner)
      )
    let version = 1
    const rest = async (restKind: 'SHORT' | 'LONG') => {
      const input = {
        restKind,
        expectedVersion: version,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC' as const,
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [],
        requestRoll: false as const
      }
      const projected = await base.owner.caller.query(preview, { id: character.id, input })
      const answer = await base.owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'COMPLETE_REST',
          commandId: crypto.randomUUID(),
          expectedVersion: version,
          restKind,
          previewFingerprint: projected.previewFingerprint,
          selectedHitDice: [],
          resetMaximumHitPointModifier: false,
          healingMode: 'AUTOMATIC',
          manualHealingAccepted: false,
          selectedCompanionInstanceIds: []
        }
      })
      version = answer.streamVersion
    }
    /** Ends the held effect, as its holder's action against an enemy does in play. */
    const end = async () => {
      const [held] = await effects()
      if (!held) throw new Error('Expected a held standing effect.')
      await base.t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).deleteCas({
          id: held.id,
          owner,
          expectedVersion: held.version,
          removal: 'ENDED'
        })
      )
    }
    const held = async () =>
      (await effects()).map(({ definition }) => ({
        authoredEffectId: definition.authoredEffectId,
        origin: definition.origin.kind,
        lifetimeScope: definition.recurrence.lifetimeScope
      }))
    return { rest, end, held }
  }

  const NOTHING_TO_RECOVER = 'This rest has no completed recovery to apply.'
  const ward = {
    authoredEffectId: STANDING_WARD_EFFECT_ID,
    origin: 'CHARACTER',
    lifetimeScope: 'OWNER'
  }

  it('a long rest turns it on once, and a later rest makes no second one', async () => {
    const { rest, held } = await fixture('LONG_REST')
    expect(await held()).toEqual([])
    await rest('LONG')
    expect(await held()).toEqual([ward])
    await expect(rest('LONG')).rejects.toThrow(NOTHING_TO_RECOVER)
    expect(await held()).toEqual([ward])
  })

  it('once ended it stays ended through a short rest, until the long rest it returns on', async () => {
    const { rest, end, held } = await fixture('LONG_REST')
    await rest('LONG')
    await end()
    await expect(rest('SHORT')).rejects.toThrow(NOTHING_TO_RECOVER)
    expect(await held()).toEqual([])
    await rest('LONG')
    expect(await held()).toEqual([ward])
  })

  it('a short rest turns a short-rest effect back on', async () => {
    const { rest, end, held } = await fixture('SHORT_REST')
    await rest('SHORT')
    expect(await held()).toEqual([ward])
    await end()
    await rest('SHORT')
    expect(await held()).toEqual([ward])
  })
})
