import { describe, expectTypeOf, it } from 'vitest'
import type { ModifierGrantAuthored } from '@artificer-toolkit/shared/authored'

import type { ModifierGrantDto } from '../grants/modifier.js'

describe('modifier grant schema and authored type', () => {
  it('types every schema variant as a supported authored domain, kind and payload', () => {
    expectTypeOf<ModifierGrantDto>().toExtend<ModifierGrantAuthored>()
  })
})
