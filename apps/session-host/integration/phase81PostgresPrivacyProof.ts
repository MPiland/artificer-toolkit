import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { type DBLike } from '@artificer-toolkit/db'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { sql } from 'kysely'

import { getEncounterSceneProjection } from '../../../packages/functions/src/services/encounter/vttSceneService.js'
import { compileSceneCurrentProjection } from '../../../packages/functions/src/services/encounter/sceneProjectionReplay.js'

import { createPhase81PostgresCommittedFixture } from './phase81PostgresCommittedFixture.js'
import type { Phase81PostgresEnvironment } from './phase81PostgresRaceSupport.js'

async function assertBrowserRoleDenied(db: DBLike, role: 'anon' | 'authenticated'): Promise<void> {
  for (const table of ['campaign_live_scenes', 'campaign_scene_events'] as const) {
    await assert.rejects(
      db.transaction().execute(async (trx) => {
        await sql.raw(`set local role ${role}`).execute(trx)
        await sql.raw(`select id from public.${table} limit 1`).execute(trx)
      }),
      `Browser role ${role} must not read public.${table}.`
    )
  }
}

/** Exercises the persisted live-Scene projection used by reconnecting VTT clients. */
export async function provePhase81PostgresPrivacy(
  environment: Phase81PostgresEnvironment,
  runId: string
): Promise<void> {
  const fixture = await createPhase81PostgresCommittedFixture(environment, `${runId}-privacy`)
  try {
    await assertBrowserRoleDenied(fixture.db, 'anon')
    await assertBrowserRoleDenied(fixture.db, 'authenticated')
    const scene = await fixture.ensureScene()
    const persisted = await fixture.repositories.scenes.findLiveScene(scene.sceneId)
    assert.ok(persisted, 'The committed Phase 8.1 Scene must be readable before privacy proof.')
    const privateLabel = `Phase 8.1 hidden evidence ${runId}`
    const hiddenToken = persisted.state.tokens.find(({ id }) => id === scene.creatureTokenId)
    assert.ok(hiddenToken, 'The committed Phase 8.1 Scene must contain the private-token fixture.')
    const privateToken = {
      ...hiddenToken,
      hidden: true,
      label: privateLabel,
      position: { x: 137, y: 83 }
    }
    const nextState = {
      ...persisted.state,
      tokens: persisted.state.tokens.map((token) =>
        token.id === hiddenToken.id ? privateToken : token
      ),
      version: persisted.state.version + 1
    }
    const commandId = randomUUID()
    assert.equal(
      await fixture.repositories.scenes.publishLiveCommand({
        commandFingerprint: checksumRuleDocument({
          commandId,
          kind: 'PHASE81_PRIVACY_HIDDEN_TOKEN',
          sceneId: scene.sceneId
        }),
        commandType: 'PHASE81_PRIVACY_HIDDEN_TOKEN',
        encounterId: fixture.ids.encounterId,
        event: {
          actorUserId: fixture.ids.gmUserId,
          commandId,
          delta: {
            kind: 'TOKEN_UPSERTED',
            token: privateToken
          },
          sceneId: scene.sceneId,
          version: nextState.version
        },
        eventId: randomUUID(),
        expectedVersion: persisted.state.version,
        projection: compileSceneCurrentProjection(nextState)
      }),
      true,
      'The private Scene state must be committed before projection reads.'
    )

    const gm = await getEncounterSceneProjection(fixture.db, fixture.ids.gmUserId, {
      encounterId: fixture.ids.encounterId
    })
    const player = await getEncounterSceneProjection(fixture.db, fixture.ids.playerUserId, {
      encounterId: fixture.ids.encounterId
    })
    const playerReconnect = await getEncounterSceneProjection(
      fixture.db,
      fixture.ids.playerUserId,
      {
        encounterId: fixture.ids.encounterId
      }
    )
    const gmReconnect = await getEncounterSceneProjection(fixture.db, fixture.ids.gmUserId, {
      encounterId: fixture.ids.encounterId
    })

    assert.ok(
      gm.tokens.some((token) => token.id === scene.creatureTokenId && token.label === privateLabel),
      'GM projection must retain the hidden evidence.'
    )
    assert.ok(
      !player.tokens.some((token) => token.id === scene.creatureTokenId),
      'Player projection must remove the hidden evidence rather than redact it in place.'
    )
    const playerPayload = JSON.stringify(player)
    for (const forbidden of [scene.creatureTokenId, privateLabel, '"x":137', '"y":83']) {
      assert.ok(
        !playerPayload.includes(forbidden),
        `Player projection leaked hidden token identity, provenance, count, or geometry: ${forbidden}`
      )
    }
    assert.deepEqual(
      playerReconnect,
      player,
      'Player reconnect must retain the redacted Scene view.'
    )
    assert.deepEqual(gmReconnect, gm, 'GM reconnect must retain the complete Scene view.')
  } finally {
    await fixture.cleanup()
  }
}
