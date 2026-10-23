import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { characterSheetCommandInputDtoSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import { raiseDead } from '@artificer-toolkit/source-data/srd/spells/raise-dead.js'
import { describe, expect, it } from 'vitest'

import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

describe('a return-from-death penalty across long rests (SPELLS-4.T2g2)', () => {
  it('lists the penalty in the rest preview, eases it each long rest, and ends it on the fourth', async () => {
    const fixture = await setupCharacterRun()
    const owner = { kind: 'CHARACTER' as const, characterId: fixture.character.id }
    const planned = plannedTimedCondition({
      encounterId: fixture.run.id,
      sourceActorId: fixture.actor.id,
      holderActorId: fixture.actor.id,
      spell: raiseDead,
      lifetimeScope: 'OWNER'
    })
    const effectId = crypto.randomUUID()
    const store = (ctx: Parameters<typeof createConvexEncounterStore>[0]) =>
      createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    await fixture.owner.caller.run((ctx) =>
      store(ctx).create({
        id: effectId,
        owner,
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        maintainedEffectStateId: null
      })
    )
    const held = () =>
      fixture.owner.caller.run(async (ctx) =>
        (await store(ctx).list(owner)).map((e) => e.lifecycle)
      )
    const sheetVersion = async () =>
      (await fixture.player.caller.query(api.characters.sheet.get, { id: fixture.character.id }))!
        .meta.streamVersion

    expect(await held()).toMatchObject([{ restStepsRemaining: 4 }])
    let version = await sheetVersion()
    for (const remaining of [3, 2, 1, null]) {
      const input = {
        restKind: 'LONG' as const,
        expectedVersion: version,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC' as const,
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [],
        requestRoll: false as const
      }
      const preview = await fixture.player.caller.query(api.characters.rest.preview, {
        id: fixture.character.id,
        input
      })
      expect(preview.steppedDownEffects).toEqual([{ id: effectId, label: 'Raise Dead' }])
      const rested = await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
        id: fixture.character.id,
        command: characterSheetCommandInputDtoSchema.parse({
          ...input,
          type: 'COMPLETE_REST',
          commandId: crypto.randomUUID(),
          previewFingerprint: preview.previewFingerprint
        })
      })
      version = rested.streamVersion
      const lifecycles = await held()
      if (remaining === null) expect(lifecycles).toEqual([])
      else expect(lifecycles).toMatchObject([{ restStepsRemaining: remaining }])
    }
  }, 60000)
})
