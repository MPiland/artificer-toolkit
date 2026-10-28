import { Session } from 'node:inspector'
import { it, vi } from 'vitest'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { internal } from '../_generated/api'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { fixture } from '../../tests/fixtures/characters'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { loadCharacterSheet } from './sheetPreparation'

type ProfileNode = {
  id: number
  callFrame: { functionName: string; url: string; lineNumber: number }
  children?: number[]
}
type Profile = { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] }

it('profiles the Sheet read on the seeded SRD', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const base = await fixture()
  console.log('SEED', JSON.stringify(await base.t.action(internal.content.seed.seed, {})))
  if (cleric.category !== 'BASE') throw new Error('Expected a base Class.')
  const sheet = await readySheetFixture(
    {
      base: cleric,
      subclass: lifeDomainCleric,
      spellcasting: {
        ...cleric.spellcasting!,
        spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 0 }]
      }
    },
    undefined,
    base
  )
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  for (let run = 0; run < 3; run++) {
    const totals = createDatabaseIoTotals()
    const started = performance.now()
    await sheet.owner.caller.run(async (ctx) => {
      await loadCharacterSheet(
        { ...ctx, db: countDatabaseIo(ctx.db, totals) },
        sheet.owner.userId,
        sheet.character.id
      )
    })
    console.log('PROFILE', Math.round(performance.now() - started), JSON.stringify(totals.reads))
  }
  const session = new Session()
  session.connect()
  const post = (method: string, params?: object) =>
    new Promise<{ profile: Profile }>((resolve, reject) =>
      session.post(method, params, (error, result) =>
        error ? reject(error) : resolve(result as { profile: Profile })
      )
    )
  await post('Profiler.enable')
  await post('Profiler.setSamplingInterval', { interval: 100 })
  await post('Profiler.start')
  for (let run = 0; run < 5; run++)
    await sheet.owner.caller.run(async (ctx) => {
      await loadCharacterSheet(ctx, sheet.owner.userId, sheet.character.id)
    })
  const { profile } = await post('Profiler.stop')
  const nodes = new Map(profile.nodes.map((node) => [node.id, node] as const))
  const parents = new Map<number, number>()
  for (const node of profile.nodes)
    for (const child of node.children ?? []) parents.set(child, node.id)
  const self = new Map<string, number>()
  const total = new Map<string, number>()
  const files = new Map<string, number>()
  const label = (node: ProfileNode) =>
    `${node.callFrame.functionName || '(anon)'} ${node.callFrame.url.replace(/^.*\/(apps|packages|node_modules)\//, '$1/')}:${node.callFrame.lineNumber + 1}`
  const deltas: number[] = profile.timeDeltas
  profile.samples.forEach((id, index) => {
    const dt = (deltas[index + 1] ?? 0) / 1000
    const node = nodes.get(id)!
    self.set(label(node), (self.get(label(node)) ?? 0) + dt)
    const file =
      node.callFrame.url.replace(/^.*\/(apps|packages|node_modules)\//, '$1/') ||
      node.callFrame.functionName
    files.set(file, (files.get(file) ?? 0) + dt)
    const seen = new Set<string>()
    for (
      let current: number | undefined = id;
      current !== undefined;
      current = parents.get(current)
    ) {
      const key = label(nodes.get(current)!)
      if (seen.has(key)) continue
      seen.add(key)
      total.set(key, (total.get(key) ?? 0) + dt)
    }
  })
  const top = (map: Map<string, number>, count: number) =>
    [...map]
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([key, ms]) => `${Math.round(ms / 5)}ms ${key}`)
  console.log(`CPU-SELF\n${top(self, 40).join('\n')}`)
  console.log(`CPU-FILE\n${top(files, 30).join('\n')}`)
  console.log(`CPU-TOTAL\n${top(total, 80).join('\n')}`)
}, 600_000)
