import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcRoot = join(import.meta.dirname, '..')
const routesRoot = import.meta.dirname

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return routeFiles(path)
    return /\.tsx$/u.test(entry.name) && !entry.name.startsWith('-') ? [path] : []
  })
}

describe('web SSR policy (D75)', () => {
  it('server-renders only the root, guest and signed-in layout routes', () => {
    const ssrRoutes = routeFiles(routesRoot)
      .filter((file) => /^\s*ssr: true,$/mu.test(readFileSync(file, 'utf8')))
      .map((file) => relative(routesRoot, file).replaceAll('\\', '/'))
      .sort()

    expect(ssrRoutes).toEqual(
      [
        '__root.tsx',
        '_authed.tsx',
        '_guest.tsx',
        '_guest/_auth.tsx',
        '_guest/_auth/auth.confirmed.tsx',
        '_guest/_auth/reset-password.tsx',
        '_guest/_auth/sign-in.tsx',
        '_guest/_auth/sign-up.tsx',
        '_guest/_auth/update-password.tsx',
        '_guest/_auth/verify-password-reset.tsx',
        '_guest/index.tsx',
        'logout.tsx'
      ].sort()
    )
  })

  it('renders every other route as a skeleton on the server so signed-in loaders skip Convex', () => {
    expect(readFileSync(join(srcRoot, 'start.ts'), 'utf8')).toMatch(/^\s*defaultSsr: false,$/mu)
  })

  it('keeps Better Auth from refetching the session on window focus', () => {
    expect(readFileSync(join(srcRoot, 'auth/betterAuthClient.ts'), 'utf8')).toMatch(
      /sessionOptions: \{ refetchOnWindowFocus: false \}/u
    )
  })
})
