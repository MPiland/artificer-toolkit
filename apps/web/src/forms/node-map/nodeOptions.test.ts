import { describe, expect, it } from 'vitest'
import { defaultSourceOptionResolver } from './nodeOptions'

describe('defaultSourceOptionResolver', () => {
  it('resolves an explicit inline-options source', () => {
    expect(
      defaultSourceOptionResolver({
        source: {
          kind: 'INLINE_OPTIONS',
          options: [{ code: 'A', label: 'Option A' }]
        }
      })
    ).toEqual([{ value: 'A', label: 'Option A' }])
  })

  it('resolves only visible groups from an explicit inline-groups source', () => {
    expect(
      defaultSourceOptionResolver({
        source: {
          kind: 'INLINE_GROUPS',
          optionGroups: [
            {
              showIf: {
                kind: 'PREDICATE',
                from: 'LOCAL',
                path: ['kind'],
                op: '=',
                value: 'VISIBLE'
              },
              options: [{ code: 'A', label: 'Option A' }]
            },
            {
              showIf: {
                kind: 'PREDICATE',
                from: 'LOCAL',
                path: ['kind'],
                op: '=',
                value: 'HIDDEN'
              },
              options: [{ code: 'B', label: 'Option B' }]
            }
          ]
        },
        values: { kind: 'VISIBLE' }
      })
    ).toEqual([{ value: 'A', label: 'Option A' }])
  })

  it('marks data-backed sources as unavailable in the static resolver', () => {
    expect(
      defaultSourceOptionResolver({
        source: {
          kind: 'DATA',
          relationship: {
            kind: 'TABLE',
            table: 'skills',
            selectColumns: ['id', 'label']
          }
        }
      })
    ).toEqual([
      {
        value: '__runtime_options_unresolved__',
        label: 'Runtime options unavailable',
        disabled: true
      }
    ])
  })
})
