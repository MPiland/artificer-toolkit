import { describe, expect, it } from 'vitest'
import { getSessionWorkspaceViews } from './CampaignSessionWorkspace'

describe('getSessionWorkspaceViews', () => {
  it('keeps GM preparation private', () => {
    expect(getSessionWorkspaceViews('OWNER', 'OPEN')).toEqual(['PREPARE', 'RUN', 'CLOSEOUT'])
    expect(getSessionWorkspaceViews('PLAYER', 'OPEN')).toEqual(['RUN'])
  })

  it('sends players to shared history after finish', () => {
    expect(getSessionWorkspaceViews('PLAYER', 'FINISHED')).toEqual(['CLOSEOUT'])
  })
})
