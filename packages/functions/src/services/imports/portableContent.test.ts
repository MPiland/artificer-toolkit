import { describe, expect, it } from 'vitest'

import { normalizeImportedAuthoredPayload } from './portableContent.js'

describe('portable content', () => {
  it('remaps external references only when their subject kind matches', () => {
    const payload = { id: 'spell-old', label: 'Spark', classId: 'shared-id' }

    const wrongKind = normalizeImportedAuthoredPayload(
      payload,
      'SPELL',
      'spell-new',
      'Spark',
      'system-1',
      'user-1',
      () => 'generated-id',
      false,
      new Map([['SPELL:shared-id', 'wrong-subject']])
    )
    const matchingKind = normalizeImportedAuthoredPayload(
      payload,
      'SPELL',
      'spell-new',
      'Spark',
      'system-1',
      'user-1',
      () => 'generated-id',
      false,
      new Map([['CLASS:shared-id', 'class-new']])
    )

    expect(wrongKind.classId).toBe('shared-id')
    expect(matchingKind.classId).toBe('class-new')
  })
})
