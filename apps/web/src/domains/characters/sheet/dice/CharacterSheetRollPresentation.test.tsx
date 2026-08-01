import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState, type ReactNode } from 'react'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { CharacterSheetRollPresentation } from './CharacterSheetRollPresentation'

const testState = vi.hoisted(() => ({
  animate3d: true,
  reducedMotion: false,
  suspendCanvas: false,
  webGLAvailable: true
}))
const pendingCanvas = vi.hoisted(() => new Promise<never>(() => undefined))
let canvasMounts = 0
let canvasUnmounts = 0
let suspendedCanvasRenders = 0
let rollRevealed = vi.fn()

vi.mock('@mantine/hooks', () => ({
  useMediaQuery: () => testState.reducedMotion
}))

vi.mock('#app/settings/dicePreferences', () => ({
  useDicePresentationPreferences: () => [
    {
      animate3d: testState.animate3d,
      postProcessing: true,
      shadowQuality: 'MEDIUM'
    }
  ]
}))

vi.mock('./dice.utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./dice.utils')>()),
  supportsWebGL: () => testState.webGLAvailable
}))

vi.mock('./DiceCanvas', () => ({
  default: ({
    onRollSettled,
    roll,
    staticFallback
  }: {
    onRollSettled: (rollId: string) => void
    roll?: RollRecordDto
    staticFallback: ReactNode
  }) => {
    const [settledRollId, setSettledRollId] = useState<string>()

    useEffect(() => {
      canvasMounts += 1
      return () => {
        canvasUnmounts += 1
      }
    }, [])

    useEffect(() => setSettledRollId(undefined), [roll?.id])

    if (testState.suspendCanvas) {
      suspendedCanvasRenders += 1
      throw pendingCanvas
    }

    return (
      <div data-testid='dice-canvas'>
        {roll?.id ?? 'idle'}
        {roll ? (
          <button
            onClick={() => {
              setSettledRollId(roll.id)
              onRollSettled(roll.id)
            }}
          >
            Finish roll
          </button>
        ) : null}
        {roll && settledRollId === roll.id ? staticFallback : null}
      </div>
    )
  }
}))

function createRoll(id: string): RollRecordDto {
  return {
    id,
    characterId: 'character-1',
    characterLabel: 'Aria',
    source: { kind: 'ABILITY_CHECK', label: 'Strength check' },
    ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
    normalizedExpression: '1d20',
    evidence: {
      terms: [{ count: 1, die: 20, rolls: [14], subtotal: 14 }],
      modifier: 0,
      mode: 'NORMAL',
      subtotal: 14,
      transform: { kind: 'NONE' },
      total: 14
    },
    createdAt: '2026-07-31T12:00:00.000Z'
  }
}

function createLargeRoll() {
  const roll = createRoll('roll-large')
  roll.normalizedExpression = '21d20'
  roll.evidence.terms = [
    {
      count: 21,
      die: 20,
      rolls: Array.from({ length: 21 }, () => 10),
      subtotal: 210
    }
  ]
  roll.evidence.subtotal = 210
  roll.evidence.total = 210
  return roll
}

describe('CharacterSheetRollPresentation', () => {
  beforeEach(() => {
    canvasMounts = 0
    canvasUnmounts = 0
    suspendedCanvasRenders = 0
    testState.animate3d = true
    testState.reducedMotion = false
    testState.suspendCanvas = false
    testState.webGLAvailable = true
    rollRevealed = vi.fn()
  })

  it('does not reveal the authoritative result while the 3D canvas is loading', async () => {
    testState.suspendCanvas = true

    render(
      <CharacterSheetRollPresentation
        onRollRevealed={rollRevealed}
        roll={createRoll('roll-loading')}
      />
    )

    await vi.waitFor(() => expect(suspendedCanvasRenders).toBeGreaterThan(0))
    expect(screen.queryByText('Rolled 14')).not.toBeInTheDocument()
  })

  it('keeps one 3D canvas mounted between clearing and rerolling', async () => {
    const { rerender } = render(
      <CharacterSheetRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-1')} />
    )
    const canvas = await screen.findByTestId('dice-canvas')

    rerender(<CharacterSheetRollPresentation onRollRevealed={rollRevealed} />)
    expect(screen.getByTestId('dice-canvas')).toBe(canvas)
    expect(canvas).toHaveTextContent('idle')

    rerender(
      <CharacterSheetRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-2')} />
    )
    expect(screen.getByTestId('dice-canvas')).toBe(canvas)
    expect(canvas).toHaveTextContent('roll-2')
    expect(canvasMounts).toBe(1)
    expect(canvasUnmounts).toBe(0)
  })

  it.each([
    ['3D is disabled', { animate3d: false }],
    ['reduced motion is requested', { reducedMotion: true }],
    ['WebGL is unavailable', { webGLAvailable: false }]
  ])('uses the static result before mounting a canvas when %s', async (_label, state) => {
    Object.assign(testState, state)

    render(
      <CharacterSheetRollPresentation
        onRollRevealed={rollRevealed}
        roll={createRoll('roll-static')}
      />
    )

    expect(await screen.findByText('Rolled 14')).toBeInTheDocument()
    expect(screen.queryByTestId('dice-canvas')).not.toBeInTheDocument()
  })

  it('uses the static result for more than 20 visual dice', async () => {
    render(
      <CharacterSheetRollPresentation onRollRevealed={rollRevealed} roll={createLargeRoll()} />
    )

    expect(await screen.findByText('Rolled 210')).toBeInTheDocument()
    expect(screen.queryByTestId('dice-canvas')).not.toBeInTheDocument()
  })

  it('keeps an existing canvas idle when a later roll needs the static fallback', async () => {
    const { rerender } = render(
      <CharacterSheetRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-1')} />
    )
    const canvas = await screen.findByTestId('dice-canvas')

    rerender(
      <CharacterSheetRollPresentation onRollRevealed={rollRevealed} roll={createLargeRoll()} />
    )

    expect(screen.getByTestId('dice-canvas')).toBe(canvas)
    expect(canvas).toHaveTextContent('idle')
    expect(screen.getByText('Rolled 210')).toBeInTheDocument()
    expect(canvasMounts).toBe(1)
    expect(canvasUnmounts).toBe(0)
  })

  it('reveals the 2D result and history only after the 3D dice settle', async () => {
    const roll = createRoll('roll-settled')

    render(<CharacterSheetRollPresentation onRollRevealed={rollRevealed} roll={roll} />)

    expect(screen.queryByText('Rolled 14')).not.toBeInTheDocument()
    expect(rollRevealed).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'Finish roll' }))

    expect(screen.getByText('Rolled 14')).toBeInTheDocument()
    expect(rollRevealed).toHaveBeenCalledOnce()
    expect(rollRevealed).toHaveBeenCalledWith(roll.id)
  })
})
