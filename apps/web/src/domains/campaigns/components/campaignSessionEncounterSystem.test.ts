import type { CampaignSessionAttendanceDto } from '@artificer-toolkit/schema/api/campaignSessions'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { attendanceCanSupplyEncounterSystem } from './campaignSessionEncounterSystem'

const memberships = [
  {
    userId: '00000000-0000-4000-8000-000000000001',
    username: 'player-one',
    role: 'PLAYER',
    accessStartedAt: '2026-08-13T12:00:00.000Z',
    acceptedAt: '2026-08-13T12:00:00.000Z',
    assignedCharacter: {
      id: '00000000-0000-4000-8000-000000000011',
      publicId: 'character-one',
      label: 'Character One',
      systemId: '00000000-0000-4000-8000-000000000021'
    }
  }
] satisfies CampaignDetailDto['memberships']

function attendance(present: boolean): CampaignSessionAttendanceDto[] {
  return [
    {
      campaignId: '00000000-0000-4000-8000-000000000031',
      sessionId: '00000000-0000-4000-8000-000000000041',
      characterId: '00000000-0000-4000-8000-000000000011',
      present
    }
  ]
}

describe('attendanceCanSupplyEncounterSystem', () => {
  it('uses a present assigned Character as the encounter system source', () => {
    expect(attendanceCanSupplyEncounterSystem(attendance(true), memberships)).toBe(true)
  })

  it('does not use absent or unassigned Characters as a system source', () => {
    expect(attendanceCanSupplyEncounterSystem(attendance(false), memberships)).toBe(false)
    expect(attendanceCanSupplyEncounterSystem(attendance(true), [])).toBe(false)
  })
})
