import { describe, expect, it } from 'vitest'
import { LIVE_SESSION_TRY_AGAIN_MESSAGE } from '@artificer-toolkit/schema/api/liveSessionCommands'
import { LiveSessionRouteError } from './liveSessionRoutes.js'
import { encounterCommandRefusal } from './nativeRoomEncounterCommand.js'

describe('encounterCommandRefusal', () => {
  it('offers a retry when Convex ran out of time and keeps STALE_STATE for real staleness (D47)', () => {
    expect(encounterCommandRefusal(new LiveSessionRouteError(503))).toEqual({
      code: 'UNAVAILABLE',
      message: LIVE_SESSION_TRY_AGAIN_MESSAGE
    })
    expect(encounterCommandRefusal(new LiveSessionRouteError(409))).toMatchObject({
      code: 'STALE_STATE'
    })
    expect(encounterCommandRefusal(new LiveSessionRouteError(0))).toEqual({
      code: 'UNAVAILABLE',
      message: 'The Encounter command could not be completed.'
    })
  })
})
