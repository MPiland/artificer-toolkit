import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { durationsFromReports, longestFirst, shardPaths } from './convexShards.mjs'

const durations = {
  'a.test.ts': 90,
  'b.test.ts': 60,
  'c.test.ts': 50,
  'd.test.ts': 40,
  'e.test.ts': 30
}
const paths = Object.keys(durations)

describe('convexShards', () => {
  it('puts every file on exactly one shard', () => {
    const shards = [1, 2, 3].map((index) => shardPaths(paths, durations, 3, index))
    expect(shards.flat().toSorted()).toEqual(paths)
  })

  it('gives each file to the shard with the least recorded time so far', () => {
    expect([1, 2].map((index) => shardPaths(paths, durations, 2, index))).toEqual([
      ['a.test.ts', 'd.test.ts'],
      ['b.test.ts', 'c.test.ts', 'e.test.ts']
    ])
  })

  it('counts a file without a record as the median recorded file', () => {
    expect(longestFirst(['new.test.ts', ...paths], durations)).toEqual([
      'a.test.ts',
      'b.test.ts',
      'c.test.ts',
      'new.test.ts',
      'd.test.ts',
      'e.test.ts'
    ])
  })

  it('orders equal durations by path, whatever the input order', () => {
    const even = { 'x.test.ts': 5, 'y.test.ts': 5 }
    expect(longestFirst(['y.test.ts', 'x.test.ts'], even)).toEqual(['x.test.ts', 'y.test.ts'])
  })

  it('records per-file milliseconds by repo-relative path from vitest JSON reports', () => {
    const root = join('/repo')
    const report = (name, startTime, endTime) => ({
      testResults: [{ name: join(root, name), startTime, endTime }]
    })
    expect(
      durationsFromReports(
        [
          report('apps/apis/convex/b.test.ts', 100, 350.4),
          report('apps/apis/convex/a.test.ts', 0, 10)
        ],
        root
      )
    ).toEqual({ 'apps/apis/convex/a.test.ts': 10, 'apps/apis/convex/b.test.ts': 250 })
  })
})
