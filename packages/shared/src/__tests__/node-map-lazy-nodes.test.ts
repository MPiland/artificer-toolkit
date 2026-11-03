import { expect, it, vi } from 'vitest'

import { buildNodeMap } from '#utils'

it('builds a node map on the first read of its nodes, once', () => {
  const nameNode = buildNodeMap<{ name: string }>()
  const build = vi.fn<Parameters<typeof nameNode.define>[1]>(({ map, nodes }) => {
    map.set('name', nodes.text(['name'], 'Name'))
  })

  const map = nameNode.define('lazy-build', build)

  expect(build).not.toHaveBeenCalled()
  expect(Object.keys(map.nodes)).toEqual(['name'])
  expect(map.nodes).toBe(map.nodes)
  expect(build).toHaveBeenCalledTimes(1)
})
