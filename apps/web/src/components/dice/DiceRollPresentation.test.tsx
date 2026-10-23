import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState, type ReactNode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { addedAdvantageRoll, cancelledAdvantageRoll } from './adjustedRoll.fixtures'
import { MODE_CHANGE_ANIMATION_MS } from './dice.utils'
import { DiceRollPresentation } from './DiceRollPresentation'

const testState = vi.hoisted(() => ({
  animate3d: true,
  reducedMotion: false,
  suspendCanvas: false,
  webGLAvailable: true
}))
const pendingCanvas = vi.hoisted(() => new Promise<never>(() => undefined))
let canvasMounts = 0
let canvasUnmounts = 0
let webGLProbes = 0
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
  supportsWebGL: () => {
    webGLProbes += 1
    return testState.webGLAvailable
  }
}))

vi.mock('./DiceCanvas', () => ({
  default: ({
    onReady,
    onRollSettled,
    roll,
    staticFallback
  }: {
    onReady: (rollId: string) => void
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

    useEffect(() => {
      if (roll && !testState.suspendCanvas) onReady(roll.id)
    }, [onReady, roll])

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
      keep: 'FIRST',
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

describe('DiceRollPresentation', () => {
  beforeEach(() => {
    canvasMounts = 0
    canvasUnmounts = 0
    webGLProbes = 0
    suspendedCanvasRenders = 0
    testState.animate3d = true
    testState.reducedMotion = false
    testState.suspendCanvas = false
    testState.webGLAvailable = true
    rollRevealed = vi.fn()
  })

  afterEach(() => vi.useRealTimers())

  it('uses the static result when 3D loading exceeds its deadline', async () => {
    vi.useFakeTimers()
    testState.suspendCanvas = true
    const roll = createRoll('roll-loading')

    render(<DiceRollPresentation onRollRevealed={rollRevealed} roll={roll} />)

    await vi.waitFor(() => expect(suspendedCanvasRenders).toBeGreaterThan(0))
    expect(screen.queryByText('Rolled 14')).not.toBeInTheDocument()

    await act(async () => vi.advanceTimersByTimeAsync(10_000))

    expect(screen.getByText('Rolled 14')).toBeInTheDocument()
    expect(rollRevealed).toHaveBeenCalledWith(roll.id)
  })

  it('keeps one 3D canvas mounted between clearing and rerolling', async () => {
    const { rerender } = render(
      <DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-1')} />
    )
    const canvas = await screen.findByTestId('dice-canvas')

    rerender(<DiceRollPresentation onRollRevealed={rollRevealed} />)
    expect(screen.getByTestId('dice-canvas')).toBe(canvas)
    expect(canvas).toHaveTextContent('idle')

    rerender(<DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-2')} />)
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

    render(<DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-static')} />)

    expect(await screen.findByText('Rolled 14')).toBeInTheDocument()
    expect(screen.queryByTestId('dice-canvas')).not.toBeInTheDocument()
  })

  it('uses the static result for more than 20 visual dice', async () => {
    render(<DiceRollPresentation onRollRevealed={rollRevealed} roll={createLargeRoll()} />)

    expect(await screen.findByText('Rolled 210')).toBeInTheDocument()
    expect(screen.queryByTestId('dice-canvas')).not.toBeInTheDocument()
  })

  it('shows every die of a cancelled advantage with a cancelled mark and the caption', async () => {
    testState.animate3d = false
    const roll = cancelledAdvantageRoll()

    render(<DiceRollPresentation onRollRevealed={rollRevealed} roll={roll} />)

    expect(await screen.findByText('Rolled 10')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('16')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'cancelled' })).toHaveLength(1)
    expect(screen.getByText('Advantage cancelled: the target can sense you')).toBeInTheDocument()
    expect(screen.queryByText('added')).not.toBeInTheDocument()
    expect(screen.getByText('Advantage → Normal')).toBeInTheDocument()
  })

  it('marks an added die as added and keeps the kept die', async () => {
    testState.animate3d = false

    render(<DiceRollPresentation onRollRevealed={rollRevealed} roll={addedAdvantageRoll()} />)

    expect(await screen.findByText('Rolled 20')).toBeInTheDocument()
    expect(screen.getByText('added')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'cancelled' })).not.toBeInTheDocument()
    expect(screen.getByText("Advantage: the target can't see you")).toBeInTheDocument()
    expect(screen.getByText('Normal → Advantage')).toBeInTheDocument()
  })

  describe('mode change animation (ENCOUNTER-8.1)', () => {
    const overlay = () => screen.getByText(/^Rolled /).closest('[data-mode-change], [aria-live]')

    beforeEach(() => {
      testState.animate3d = false
      vi.useFakeTimers()
    })

    it('plays once when the card arrives, then settles to the static result', () => {
      const roll = cancelledAdvantageRoll('arriving-roll')
      render(<DiceRollPresentation onRollRevealed={rollRevealed} roll={roll} />)

      expect(overlay()).toHaveAttribute('data-mode-change', 'playing')
      act(() => vi.advanceTimersByTime(MODE_CHANGE_ANIMATION_MS))
      expect(overlay()).not.toHaveAttribute('data-mode-change')
      expect(screen.getAllByRole('img', { name: 'cancelled' })).toHaveLength(1)
    })

    it('does not replay when the same card is opened again', () => {
      const roll = addedAdvantageRoll('reopened-roll')
      const first = render(<DiceRollPresentation onRollRevealed={rollRevealed} roll={roll} />)
      expect(overlay()).toHaveAttribute('data-mode-change', 'playing')
      act(() => vi.advanceTimersByTime(MODE_CHANGE_ANIMATION_MS))
      first.unmount()

      render(<DiceRollPresentation onRollRevealed={rollRevealed} roll={roll} />)
      expect(overlay()).not.toHaveAttribute('data-mode-change')
      expect(screen.getByText('added')).toBeInTheDocument()
    })

    it('shows the static result with no animation under reduced motion', () => {
      testState.reducedMotion = true
      render(
        <DiceRollPresentation
          onRollRevealed={rollRevealed}
          roll={cancelledAdvantageRoll('reduced-motion-roll')}
        />
      )

      expect(overlay()).not.toHaveAttribute('data-mode-change')
      expect(screen.getAllByRole('img', { name: 'cancelled' })).toHaveLength(1)
      expect(screen.getByText('Advantage → Normal')).toBeInTheDocument()
    })
  })

  it('keeps an existing canvas idle when a later roll needs the static fallback', async () => {
    const { rerender } = render(
      <DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-1')} />
    )
    const canvas = await screen.findByTestId('dice-canvas')

    rerender(<DiceRollPresentation onRollRevealed={rollRevealed} roll={createLargeRoll()} />)

    expect(screen.getByTestId('dice-canvas')).toBe(canvas)
    expect(canvas).toHaveTextContent('idle')
    expect(screen.getByText('Rolled 210')).toBeInTheDocument()
    expect(canvasMounts).toBe(1)
    expect(canvasUnmounts).toBe(0)
  })

  it('reveals the 2D result and history only after the 3D dice settle', async () => {
    const roll = createRoll('roll-settled')

    render(<DiceRollPresentation onRollRevealed={rollRevealed} roll={roll} />)
    const canvas = await screen.findByTestId('dice-canvas')

    expect(screen.queryByText('Rolled 14')).not.toBeInTheDocument()
    expect(rollRevealed).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'Finish roll' }))

    expect(screen.getByText('Rolled 14')).toBeInTheDocument()
    expect(canvas).toHaveTextContent('idle')
    expect(rollRevealed).toHaveBeenCalledOnce()
    expect(rollRevealed).toHaveBeenCalledWith(roll.id)
  })

  describe('reveal notification (RELIABILITY-9.3)', () => {
    it('notifies a statically shown roll once, across rerenders and a new callback identity', async () => {
      testState.animate3d = false
      const { rerender } = render(
        <DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-1')} />
      )
      await screen.findByText('Rolled 14')
      expect(rollRevealed).toHaveBeenCalledExactlyOnceWith('roll-1')

      rerender(<DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-1')} />)
      const replacement = vi.fn()
      rerender(<DiceRollPresentation onRollRevealed={replacement} roll={createRoll('roll-1')} />)

      expect(rollRevealed).toHaveBeenCalledOnce()
      expect(replacement).not.toHaveBeenCalled()
    })

    it('notifies again for a new roll id, once each', () => {
      testState.animate3d = false
      const { rerender } = render(
        <DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-1')} />
      )
      rerender(<DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-2')} />)
      rerender(<DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-2')} />)

      expect(rollRevealed.mock.calls).toEqual([['roll-1'], ['roll-2']])
    })

    it('notifies a 3D roll only after the reveal has committed, and only once', async () => {
      const shownWhenNotified: boolean[] = []
      const onRevealed = vi.fn(() => {
        shownWhenNotified.push(screen.queryByText('Rolled 14') !== null)
      })
      const { rerender } = render(
        <DiceRollPresentation onRollRevealed={onRevealed} roll={createRoll('roll-3d')} />
      )
      expect(onRevealed).not.toHaveBeenCalled()
      fireEvent.click(await screen.findByRole('button', { name: 'Finish roll' }))

      expect(onRevealed).toHaveBeenCalledExactlyOnceWith('roll-3d')
      expect(shownWhenNotified).toEqual([true])

      rerender(<DiceRollPresentation onRollRevealed={onRevealed} roll={createRoll('roll-3d')} />)
      expect(onRevealed).toHaveBeenCalledOnce()
    })

    it('resets the reveal state for the next roll', async () => {
      const { rerender } = render(
        <DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-1')} />
      )
      fireEvent.click(await screen.findByRole('button', { name: 'Finish roll' }))
      expect(screen.getByText('Rolled 14')).toBeInTheDocument()

      rerender(<DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-2')} />)

      expect(screen.getByTestId('dice-canvas')).toHaveTextContent('roll-2')
      expect(screen.queryByText('Rolled 14')).not.toBeInTheDocument()
      expect(rollRevealed).toHaveBeenCalledOnce()

      fireEvent.click(screen.getByRole('button', { name: 'Finish roll' }))
      expect(rollRevealed.mock.calls).toEqual([['roll-1'], ['roll-2']])
    })
  })

  describe('hydration (RELIABILITY-9.3)', () => {
    it('renders nothing on the server and does not probe WebGL there', () => {
      const html = renderToString(
        <DiceRollPresentation onRollRevealed={rollRevealed} roll={createRoll('roll-ssr')} />
      )

      expect(html).toBe('')
      expect(webGLProbes).toBe(0)
      expect(rollRevealed).not.toHaveBeenCalled()
    })

    it('hydrates onto the server markup without a mismatch, then probes once in the browser', async () => {
      const roll = createRoll('roll-hydrate')
      const container = document.body.appendChild(document.createElement('div'))
      container.innerHTML = renderToString(
        <DiceRollPresentation onRollRevealed={rollRevealed} roll={roll} />
      )
      const recoverable = vi.fn()

      let root!: ReturnType<typeof hydrateRoot>
      await act(async () => {
        root = hydrateRoot(
          container,
          <DiceRollPresentation onRollRevealed={rollRevealed} roll={roll} />,
          { onRecoverableError: recoverable }
        )
      })

      expect(recoverable).not.toHaveBeenCalled()
      expect(webGLProbes).toBe(1)
      expect(await screen.findByTestId('dice-canvas')).toHaveTextContent('roll-hydrate')

      act(() => root.unmount())
      container.remove()
    })
  })
})
