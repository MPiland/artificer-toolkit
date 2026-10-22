import { expect, it } from 'vitest'

import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'

it('imports workspace packages from src, not a built dist', () => {
  let stack = ''
  try {
    canonicalizeJson(undefined)
  } catch (error) {
    stack = error.stack
  }
  const path = stack.replaceAll('\\', '/')
  expect(path).toContain('packages/shared/src/utils/canonicalJson.ts')
  expect(path).not.toContain('packages/shared/dist')
})
