import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'

const { creatures, spells } = srdBaselineContent.subjects

type Effects = (typeof spells)[number]['effects']

/** The lifecycle the timed APPLY_GRANT result blocks carry; Shield's two reactions share one. */
function grantLifecycle(effects: Effects) {
  const blocks = (effects ?? [])
    .flatMap((effect) => effect.paths)
    .map((path) => {
      if (path.selectionKind !== 'FIXED') throw new Error('A spell grant path must be FIXED.')
      return path.resultBlock
    })
    .filter(
      (block) =>
        block.duration && block.outcomes.some((outcome) => outcome.effectKind === 'APPLY_GRANT')
    )
  expect(blocks.length).toBeGreaterThan(0)
  for (const block of blocks) expect(block.lifecycle).toEqual(blocks[0]?.lifecycle)
  return blocks[0]?.lifecycle
}

function spell(label: string) {
  const found = spells.find((entry) => entry.label === label)
  if (!found) throw new Error(`SRD spell "${label}" is missing.`)
  return found.effects
}

function shimmeringShield() {
  const option = creatures
    .find((entry) => entry.label === 'Unicorn')
    ?.features?.flatMap((feature) => feature.options ?? [])
    .find((entry) => entry.label.startsWith('Shimmering Shield'))
  if (!option) throw new Error("The SRD Unicorn's Shimmering Shield is missing.")
  return option.effects
}

/** D99: whose turn ends each one-round grant, as the printed text words it. */
describe('SRD grant turn anchors (D99)', () => {
  it.each([
    [
      'Shield',
      () => spell('Shield'),
      { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } }
    ],
    [
      'Shocking Grasp',
      () => spell('Shocking Grasp'),
      { turnAnchor: { actor: 'TARGET', boundary: 'START_OF_TURN' } }
    ],
    [
      'Ray of Frost',
      () => spell('Ray of Frost'),
      { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } }
    ],
    [
      'Vicious Mockery',
      () => spell('Vicious Mockery'),
      {
        turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' },
        endTriggers: [{ event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACK_ROLL' }]
      }
    ],
    [
      "the Unicorn's Shimmering Shield",
      shimmeringShield,
      { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } }
    ]
  ] as const)('%s ends on its printed turn', (_label, effects, lifecycle) => {
    expect(grantLifecycle(effects())).toEqual(lifecycle)
  })
})
