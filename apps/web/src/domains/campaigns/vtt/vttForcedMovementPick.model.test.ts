import { describe, expect, it } from 'vitest'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import {
  forcedMovementDestinationAfterKey,
  forcedMovementDestinationOverlays,
  forcedMovementDestinationPick
} from './vttForcedMovementPick.model'
import { validated } from '../../../test/validatedFixture'

const warden = tabletopLiveScene.tokens[1]!
const stay = warden.position
const east = { x: stay.x + 70, y: stay.y }
const northEast = { x: stay.x + 70, y: stay.y - 70 }
const eastNorthEast = { x: stay.x + 140, y: stay.y - 70 }

const pending = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
  kind: 'FORCED_MOVEMENT_DESTINATION',
  occurrenceId: '12121212-1212-4121-8121-121212121212',
  occurrenceVersion: 1,
  encounterVersion: 4,
  sourceActorId: '99999999-9999-4999-8999-999999999901',
  targetActorId: '99999999-9999-4999-8999-999999999902',
  requestId: 'forced-movement-request',
  positions: [stay, east, northEast, eastNorthEast],
  allowedResponses: ['FORCED_MOVEMENT']
})
if (pending.kind !== 'FORCED_MOVEMENT_DESTINATION') throw new Error('Unexpected pending kind.')

describe('the board pick for a forced movement’s destination (D157)', () => {
  it('names each legal square by the direction and distance the creature moves', () => {
    const pick = forcedMovementDestinationPick({
      pending,
      scene: tabletopLiveScene,
      targetTokenId: warden.id
    })
    expect(pick?.creature).toBe('Vault Warden')
    expect(pick?.destinations).toEqual([
      { position: stay, label: 'Leave Vault Warden where it is' },
      { position: east, label: 'Move Vault Warden 5 ft east' },
      { position: northEast, label: 'Move Vault Warden 5 ft north-east' },
      { position: eastNorthEast, label: 'Move Vault Warden 10 ft: 10 ft east, 5 ft north' }
    ])
    expect(pick?.squares).toEqual({
      centers: [stay, east, northEast, eastNorthEast],
      width: warden.width,
      height: warden.height
    })
  })

  it('offers no pick while the creature has no token on the Scene', () => {
    expect(
      forcedMovementDestinationPick({ pending, scene: tabletopLiveScene, targetTokenId: 'gone' })
    ).toBeNull()
  })

  it('outlines every legal square on the board and marks the focused one', () => {
    const pick = forcedMovementDestinationPick({
      pending,
      scene: tabletopLiveScene,
      targetTokenId: warden.id
    })!
    const overlays = forcedMovementDestinationOverlays(pick, east)
    expect(overlays.map(({ label, purpose }) => ({ label, purpose }))).toEqual([
      { label: 'Leave Vault Warden where it is', purpose: 'RANGE' },
      { label: 'Move Vault Warden 5 ft east', purpose: 'TARGET' },
      { label: 'Move Vault Warden 5 ft north-east', purpose: 'RANGE' },
      { label: 'Move Vault Warden 10 ft: 10 ft east, 5 ft north', purpose: 'RANGE' }
    ])
    expect(overlays[1]).toMatchObject({
      kind: 'POLYGON',
      points: [
        { x: east.x - 35, y: east.y - 35 },
        { x: east.x + 35, y: east.y - 35 },
        { x: east.x + 35, y: east.y + 35 },
        { x: east.x - 35, y: east.y + 35 }
      ]
    })
    expect(forcedMovementDestinationOverlays(null, east)).toEqual([])
  })

  it('moves the keyboard to the nearest legal square in an arrow’s direction, keeping to its row', () => {
    const squares = [stay, east, northEast, eastNorthEast]
    expect(forcedMovementDestinationAfterKey(squares, stay, 'ArrowRight')).toEqual(east)
    expect(forcedMovementDestinationAfterKey(squares, east, 'ArrowUp')).toEqual(northEast)
    expect(forcedMovementDestinationAfterKey(squares, northEast, 'ArrowRight')).toEqual(
      eastNorthEast
    )
    expect(forcedMovementDestinationAfterKey(squares, eastNorthEast, 'ArrowDown')).toEqual(east)
    expect(forcedMovementDestinationAfterKey(squares, east, 'ArrowLeft')).toEqual(stay)
  })

  it('keeps the focus when no legal square lies that way, and ignores other keys', () => {
    const squares = [stay, east, northEast, eastNorthEast]
    expect(forcedMovementDestinationAfterKey(squares, stay, 'ArrowLeft')).toEqual(stay)
    expect(forcedMovementDestinationAfterKey(squares, stay, 'Tab')).toBeNull()
  })
})
