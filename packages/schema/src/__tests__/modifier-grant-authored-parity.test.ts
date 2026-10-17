import { describe, expectTypeOf, it } from 'vitest'
import type { ModifierGrantAuthored } from '@artificer-toolkit/shared/authored'

import type { ModifierGrantDto } from '../grants/modifier.js'

describe('modifier grant schema and authored type', () => {
  it('types every schema variant as a supported authored domain, kind and payload', () => {
    // A plain assignment: vitest's toExtend mismatch constraint cannot evaluate a union this large.
    const toAuthored = (grant: ModifierGrantDto): ModifierGrantAuthored => grant
    expectTypeOf(toAuthored).returns.toEqualTypeOf<ModifierGrantAuthored>()
  })
})
