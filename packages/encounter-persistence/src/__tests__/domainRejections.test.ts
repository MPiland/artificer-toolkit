import { describe, expect, it } from 'vitest'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import { EncounterDomainRejection, rejectDomain } from '../domainRejections.js'

describe('Encounter domain rejections', () => {
  it('throw the package rejection with the client data', () => {
    let thrown: unknown
    try {
      rejectDomain('VERSION_STALE')
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(EncounterDomainRejection)
    expect((thrown as EncounterDomainRejection).data).toStrictEqual({
      code: 'DOMAIN_REJECTED',
      reason: 'VERSION_STALE',
      message: DOMAIN_REJECTION_MESSAGES.VERSION_STALE
    })
    expect(() => rejectDomain('GM_ONLY', 'Only the GM can.')).toThrow('Only the GM can.')
  })
})
