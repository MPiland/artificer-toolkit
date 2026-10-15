import { describe, expect, it } from 'vitest'

import { manifestDtoSchema } from '../effects/manifest.js'

const manifest = (manifestKind: string, fields: Record<string, unknown> = {}) => ({
  id: 'manifest-1',
  effectKind: 'MANIFEST',
  manifestKind,
  ...fields
})

describe('manifest attachment', () => {
  it('requires a ZONE manifest to state where it is placed', () => {
    expect(manifestDtoSchema.safeParse(manifest('ZONE')).success).toBe(false)
    expect(
      manifestDtoSchema.safeParse(manifest('ZONE', { attachmentKind: 'PLACED_SPACE' })).success
    ).toBe(true)
  })

  it.each(['SENSOR', 'WEAPON', 'OBJECT', 'ILLUSION', 'CREATURE', 'SUMMON'])(
    'keeps attachment optional on %s manifests',
    (manifestKind) => {
      expect(manifestDtoSchema.safeParse(manifest(manifestKind)).success).toBe(true)
    }
  )
})
