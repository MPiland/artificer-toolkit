import { describe, expect, it } from 'vitest'

import { bindEncounterD20Evidence, requireEncounterD20Evidence } from './nativeD20Evidence.js'

const refusal = 'A check requires d20 evidence.'
const rollId = 'abababab-abab-4bab-8bab-abababababab'
const appRoll = {
  rollId,
  faces: [14],
  rollMode: 'NORMAL' as const,
  keep: 'FIRST' as const
}
const systemRoll = { kind: 'SYSTEM_ROLL' as const, requestId: 'request-1', rollId }

describe('Worker d20 evidence binding', () => {
  it('binds an app-roll answer to the faces Convex recorded for it', () => {
    const answer = bindEncounterD20Evidence({
      response: { resolution: systemRoll, appRoll },
      refusal
    })
    expect(answer).toMatchObject({ kind: 'SYSTEM_ROLL', faces: [14], rollMode: 'NORMAL' })
  })

  it('rejects an app-roll answer with no app roll or a mismatched one', () => {
    expect(() =>
      bindEncounterD20Evidence({ response: { resolution: systemRoll, appRoll: null }, refusal })
    ).toThrow('The app roll does not match the answer.')
    expect(() =>
      bindEncounterD20Evidence({
        response: {
          resolution: systemRoll,
          appRoll: { ...appRoll, rollId: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd' }
        },
        refusal
      })
    ).toThrow('The app roll does not match the answer.')
  })

  it('rejects an answer that is not d20 evidence', () => {
    expect(() =>
      bindEncounterD20Evidence({
        response: {
          resolution: { kind: 'ENTER_INTEGER', requestId: 'request-1', value: 3 },
          appRoll: null
        },
        refusal
      })
    ).toThrow(refusal)
    expect(() =>
      requireEncounterD20Evidence(
        { kind: 'ENTER_INTEGER', requestId: 'request-1', value: 3 },
        refusal
      )
    ).toThrow(refusal)
  })

  it('auto-rolls only where the caller names the request', () => {
    expect(
      bindEncounterD20Evidence({ response: null, autoRollRequestId: 'request-1', refusal })
    ).toEqual({ kind: 'AUTO_ROLL', requestId: 'request-1' })
    expect(() => bindEncounterD20Evidence({ response: null, refusal })).toThrow(refusal)
  })
})
