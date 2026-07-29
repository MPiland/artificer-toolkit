import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const domains = [
  'backgrounds',
  'classes',
  'creatures',
  'equipment',
  'feats',
  'races',
  'spells',
  'vehicles'
] as const

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function route(domain: string, detail = false): string {
  if (!detail) return `src/routes/_authed/${domain}/index.tsx`
  const singular =
    domain === 'classes' ? 'class' : domain === 'equipment' ? 'equipment' : domain.slice(0, -1)
  return `src/routes/_authed/${domain}/$${singular}PublicId/$${singular}Slug/index.tsx`
}

describe('authored detail loading', () => {
  it('keeps every catalogue prefetch request identical to its detail loader request', () => {
    for (const domain of domains) {
      const listSource = read(route(domain))
      const detailSource = read(route(domain, true))
      const singular =
        domain === 'classes' ? 'class' : domain === 'equipment' ? 'equipment' : domain.slice(0, -1)
      const constantName = `${singular}DetailMeta`
      const metaPattern = new RegExp(`const ${constantName} = (\\[[\\s\\S]*?\\])`)
      const listMeta = metaPattern.exec(listSource)?.[1].replace(/\s/g, '')
      const detailMeta = metaPattern.exec(detailSource)?.[1].replace(/\s/g, '')

      expect(listMeta, `${domain} list meta`).toBe(detailMeta)
      expect(listSource).not.toContain('includeDraft')
      expect(detailSource).not.toContain('includeDraft')
    }
  })

  it('does not load global authoring reference data from background or class readers', () => {
    for (const domain of ['backgrounds', 'classes']) {
      expect(read(route(domain, true))).not.toContain('getAuthoredContentReferenceData')
    }
  })
})
