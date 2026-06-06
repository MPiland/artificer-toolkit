import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routeTreeSource = readFileSync(join(process.cwd(), 'src/routeTree.gen.ts'), 'utf8')

export function expectRouteTreeToDeclare(routeIds: string[]) {
  for (const routeId of routeIds) {
    expect(routeTreeSource).toContain(`'${routeId}'`)
  }
}
