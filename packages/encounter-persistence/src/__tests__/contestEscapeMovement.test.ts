import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import { SRD_ATHLETICS_SKILL_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { settleContest } from '../contestSettlement.js'

/**
 * A won contested escape moves the hold's source only as the held effect authors it (MOVE-4.3): the
 * commit re-derives that movement and never trusts the one the room planned.
 */

const list = vi.hoisted(() => vi.fn())
vi.mock('../effectStore.js', () => ({ createActiveRuleEffectStore: () => ({ list }) }))

const ENCOUNTER_ID = '00000000-0000-4000-8000-0000000000c1'
const MOUNT_ID = '00000000-0000-4000-8000-0000000000c2'
const CLIMBER_ID = '00000000-0000-4000-8000-0000000000c3'
const CLING_ID = '00000000-0000-4000-8000-0000000000c4'
const athletics = { skillIds: [SRD_ATHLETICS_SKILL_ID], abilityDefinitionIds: [] }
const mount = { id: MOUNT_ID, kind: 'CREATURE' as const, sourceId: null }
const climber = { id: CLIMBER_ID, kind: 'CREATURE' as const, sourceId: null }
/** The move the cling authors for the climber its mount dislodges, still without a picked square. */
const dislodged = {
  targetActorId: CLIMBER_ID,
  direction: 'ANY' as const,
  feet: 5,
  upTo: false,
  sourceReachFeet: null,
  position: null,
  ray: null,
  collision: null
}

beforeEach(() => {
  list.mockReset()
  list.mockResolvedValue([
    {
      id: CLING_ID,
      definition: escapeGrappleEffectDefinition({
        encounterId: ENCOUNTER_ID,
        grapplerId: CLIMBER_ID,
        conditionIds: [],
        checks: athletics,
        contestChecks: athletics,
        holderForcedMovement: {
          id: '00000000-0000-4000-8000-0000000000c5',
          effectKind: 'FORCED_MOVEMENT',
          direction: 'ANY',
          actionEconomy: 'NONE',
          distanceMode: 'EXACT',
          amount: 5,
          unit: 'FEET'
        }
      })
    }
  ])
})

/** Settles the mount's escape from the cling with `mountTotal` against 10, committing `forcedMovements`. */
function settle(mountTotal: number, forcedMovements: readonly (typeof dislodged)[]) {
  return settleContest(
    { db: {} } as Parameters<typeof settleContest>[0],
    {
      state: { id: ENCOUNTER_ID },
      actors: [mount, climber],
      actor: mount,
      target: climber,
      actionEconomy: null,
      contest: { origin: { kind: 'ESCAPE', activeEffectId: CLING_ID } },
      rolls: { initiator: { total: mountTotal }, defender: { total: 10 } },
      forcedMovements
    } as unknown as Parameters<typeof settleContest>[1]
  )
}

describe('a contested escape commit’s holder movement', () => {
  it('refuses a won escape whose movement differs from the one its hold authors', async () => {
    await expect(settle(20, [{ ...dislodged, feet: 10 }])).rejects.toThrow(
      'Contested escape movement does not match its hold.'
    )
    await expect(
      settle(20, [{ ...dislodged, direction: 'AWAY_FROM_SOURCE' as 'ANY' }])
    ).rejects.toThrow('Contested escape movement does not match its hold.')
    await expect(settle(20, [{ ...dislodged, targetActorId: MOUNT_ID }])).rejects.toThrow(
      'Contested escape movement does not match its hold.'
    )
  })

  it('refuses a won escape that drops the movement its hold authors', async () => {
    await expect(settle(20, [])).rejects.toThrow(
      'Contested escape movement does not match its hold.'
    )
  })

  it('refuses a lost escape that carries any movement', async () => {
    await expect(settle(5, [dislodged])).rejects.toThrow(
      'Contested escape movement does not match its hold.'
    )
  })
})
