import { expect, it } from 'vitest'

import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'

it('imports workspace packages from src, not a built dist', () => {
  let stack = ''
  try {
    canonicalizeJson(undefined)
  } catch (error) {
    stack = String((error as Error).stack)
  }
  const path = stack.replaceAll('\\', '/')
  expect(path).toContain('shared/src/utils/canonicalJson.ts')
  expect(path).not.toContain('shared/dist')
})
