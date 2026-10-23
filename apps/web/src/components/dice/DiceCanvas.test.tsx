import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import type { RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import DiceCanvas from './DiceCanvas'

type DiceTableProps = {
  dice: { id: string }[]
  onDieSettled: (id: string) => void
}

const renderedDiceIds = vi.hoisted(() => [] as string[][])

// WebGL, the physics engine and model loading are the platform; the canvas is replaced by a stub
// that reads the table's props instead of rendering three.js.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactElement<DiceTableProps> }) => {
    const { dice, onDieSettled } = children.props
    renderedDiceIds.push(dice.map((die) => die.id))
    return (
      <div data-testid='table'>
        {dice.map((die) => (
          <button key={die.id} onClick={() => onDieSettled(die.id)}>
            {die.id}
          </button>
        ))}
      </div>
    )
  },
  useFrame: () => undefined,
  useLoader: () => [],
  useThree: () => undefined
}))
vi.mock('@react-three/rapier', () => ({
  Physics: ({ children }: { children: ReactNode }) => children,
  useRapier: () => ({})
}))

const preferences = { animate3d: true, postProcessing: true, shadowQuality: 'MEDIUM' } as const

/** A d20 re-rolled once, so the canvas plays two stages before the dice settle. */
function createStagedRoll(id: string): RollResultDto {
  return {
    id,
    normalizedExpression: '1d20',
    evidence: {
      terms: [{ count: 1, die: 20, rolls: [12], rollSequences: [[5, 12]], subtotal: 12 }],
      modifier: 0,
      mode: 'NORMAL',
      keep: 'FIRST',
      subtotal: 12,
      transform: { kind: 'NONE' },
      total: 12
    }
  } as RollResultDto
}

function renderCanvas(roll: RollResultDto | undefined, onRollSettled = vi.fn()) {
  return (
    <DiceCanvas
      onReady={vi.fn()}
      onRollSettled={onRollSettled}
      preferences={preferences}
      roll={roll}
      staticFallback={<p>static result</p>}
    />
  )
}

describe('DiceCanvas roll changes (RELIABILITY-9.3)', () => {
  beforeEach(() => {
    renderedDiceIds.length = 0
  })

  it('restarts at the first stage for a new roll id without rendering the old stage first', () => {
    const { rerender } = render(renderCanvas(createStagedRoll('roll-a')))
    fireEvent.click(screen.getByRole('button', { name: 'roll-a:0:0:attempt:0' }))
    expect(screen.getByRole('button', { name: 'roll-a:0:0:attempt:1' })).toBeInTheDocument()

    renderedDiceIds.length = 0
    rerender(renderCanvas(createStagedRoll('roll-b')))

    expect(screen.getByRole('button', { name: 'roll-b:0:0:attempt:0' })).toBeInTheDocument()
    expect(renderedDiceIds.flat()).not.toContain('roll-b:0:0:attempt:1')
  })

  it('reports a roll settled once and shows its static result, then forgets it when the roll clears', () => {
    const onRollSettled = vi.fn()
    const { rerender } = render(renderCanvas(createStagedRoll('roll-a'), onRollSettled))
    fireEvent.click(screen.getByRole('button', { name: 'roll-a:0:0:attempt:0' }))
    fireEvent.click(screen.getByRole('button', { name: 'roll-a:0:0:attempt:1' }))

    expect(onRollSettled).toHaveBeenCalledExactlyOnceWith('roll-a')
    expect(screen.getByText('static result')).toBeInTheDocument()

    rerender(renderCanvas(undefined, onRollSettled))
    expect(screen.queryByText('static result')).not.toBeInTheDocument()

    rerender(renderCanvas(createStagedRoll('roll-a'), onRollSettled))
    expect(screen.queryByText('static result')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'roll-a:0:0:attempt:0' })).toBeInTheDocument()
  })

  it('does not count dice settled for the previous roll toward the next one', () => {
    const onRollSettled = vi.fn()
    const { rerender } = render(renderCanvas(createStagedRoll('roll-a'), onRollSettled))
    fireEvent.click(screen.getByRole('button', { name: 'roll-a:0:0:attempt:0' }))

    rerender(renderCanvas(createStagedRoll('roll-b'), onRollSettled))
    fireEvent.click(screen.getByRole('button', { name: 'roll-b:0:0:attempt:0' }))

    expect(screen.getByRole('button', { name: 'roll-b:0:0:attempt:1' })).toBeInTheDocument()
    expect(onRollSettled).not.toHaveBeenCalled()
  })
})
