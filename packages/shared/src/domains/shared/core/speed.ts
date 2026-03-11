import type { NodeMap } from '#utils'

export type SpeedNodePayloads = {
  speeds: {
    speedIds: string[]
  }
}

export const SPEED_NODE_MAP: NodeMap<SpeedNodePayloads> = {
  speeds: {
    kind: 'LEAF',
    payload: 'speeds',
    meta: {
      label: 'Speeds',
      code: 'SPEEDS',
      tooltip: 'Speeds that can be selected.'
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'speeds'
        },
        order: 0,
        selection: 'MULTI_REQUIRED'
      }
    ]
  }
}
