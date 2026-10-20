import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    const isSource = /\.(ts|tsx)$/.test(path) && !/\.(test|stories)\.tsx?$/.test(path)
    return isSource ? [path] : []
  })
}

function violations(pattern: RegExp, allowed: readonly string[] = []) {
  return sourceFiles(sourceRoot)
    .filter((path) => !allowed.some((suffix) => path.replaceAll(sep, '/').endsWith(suffix)))
    .filter((path) => pattern.test(readFileSync(path, 'utf8')))
    .map((path) => relative(process.cwd(), path))
}

describe('RELIABILITY-9.2: one all-pages contract', () => {
  it('no screen writes its own drain-all-pages effect', () => {
    expect(
      violations(/status === 'CanLoadMore'\)\s*\w+(?:\.\w+)*\.loadMore\(/, [
        'data/useLoadAllPages.ts'
      ])
    ).toEqual([])
  })
})

describe('RELIABILITY-9.7: rendering is pure and SSR-stable', () => {
  it('reads the clock in a component file only to seed or refresh state, never to render', () => {
    expect(
      violations(/Date\.now\(\)|new Date\(\)/, [
        'CampaignClock/CampaignClockControl.tsx',
        'listing-editor/SocialListingInvitations.tsx',
        'components/SocialInvitationsView.tsx'
      ]).filter((path) => path.endsWith('.tsx'))
    ).toEqual([])
  })

  it('computes no locale- or time-zone-dependent value at module load', () => {
    expect(
      violations(
        /^(?:export )?const \w+ *= *(?:new )?Intl\.\w+\(\s*undefined|^(?:export )?const \w+ *=.*\.resolvedOptions\(\)/m
      )
    ).toEqual([])
  })
})
