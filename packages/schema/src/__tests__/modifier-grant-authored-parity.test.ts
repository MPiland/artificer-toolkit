import { describe, expectTypeOf, it } from 'vitest'
import type { ModifierGrantAuthored } from '@artificer-toolkit/shared/authored'

import type { ModifierGrantDto } from '../grants/modifier.js'

/** Each schema variant that is not a supported authored domain, kind and payload, by name. */
type UnauthoredModifierVariant = ModifierGrantDto extends infer Variant
  ? Variant extends ModifierGrantDto
    ? Variant extends ModifierGrantAuthored
      ? never
      : `${Variant['valueDomainCode']} ${Variant['modifierKind']}`
    : never
  : never

describe('modifier grant schema and authored type', () => {
  it('types every schema variant as a supported authored domain, kind and payload', () => {
    expectTypeOf<UnauthoredModifierVariant>().toEqualTypeOf<never>()
  })
})
