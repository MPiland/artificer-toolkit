import { describe, expect, it } from 'vitest'

import { notificationWorkflows } from './workflows.js'

describe('notification workflows', () => {
  it('exposes the Social Hub and Campaign announcement workflows', async () => {
    const definitions = await Promise.all(
      notificationWorkflows.map((notificationWorkflow) => notificationWorkflow.discover())
    )

    expect(definitions.map((definition) => definition.workflowId)).toEqual([
      'social-application-submitted',
      'social-application-decided',
      'social-invitation-received',
      'social-invitation-decided',
      'campaign-announcement'
    ])
    expect(definitions.slice(0, 4).every((definition) => definition.tags.includes('social'))).toBe(
      true
    )
    expect(definitions[4]?.tags).toContain('campaign')
  })

  it('keeps the application-submitted digest ahead of both delivery channels', async () => {
    const definition = await notificationWorkflows[0]!.discover()

    expect(definition.steps.map((step) => [step.stepId, step.type])).toEqual([
      ['listing-digest', 'digest'],
      ['application-submitted-in-app', 'in_app'],
      ['application-submitted-email', 'email']
    ])
  })
})
