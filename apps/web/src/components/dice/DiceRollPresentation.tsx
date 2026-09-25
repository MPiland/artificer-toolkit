import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import type { RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import { formatRollEvidence, getVisualDiceCount, MAX_3D_DICE, supportsWebGL } from './dice.utils'
import { DiceCanvasErrorBoundary } from './DiceCanvasErrorBoundary'
import * as diceStyles from './dice.css'

const DiceCanvas = lazy(() => import('./DiceCanvas'))
const DICE_LOAD_TIMEOUT_MS = 10_000

function StaticDiceResult({ roll }: { roll: RollResultDto }) {
  return (
    <div className={diceStyles.staticDiceOverlay} aria-live='polite'>
      <div className={diceStyles.staticDiceList}>
        {roll.evidence.terms.flatMap((term, termIndex) =>
          term.rolls.map((value, rollIndex) => {
            const kept = term.keptRollIndexes
              ? term.keptRollIndexes.includes(rollIndex)
              : term.keptRollIndex == null || term.keptRollIndex === rollIndex
            return (
              <span
                className={diceStyles.staticDie}
                data-kept={kept ? 'true' : undefined}
                key={`${termIndex}:${rollIndex}`}
              >
                <small>
                  d{term.die}
                  {term.keptRollIndex == null ? '' : kept ? ' · kept' : ' · dropped'}
                  {term.keptRollIndexes ? (kept ? ' · kept' : ' · dropped') : ''}
                </small>
                <strong>{value}</strong>
              </span>
            )
          })
        )}
      </div>
      <div className={diceStyles.staticRollSummary}>
        <strong>Rolled {roll.evidence.total}</strong>
        <span>{formatRollEvidence(roll.evidence)}</span>
      </div>
    </div>
  )
}

export function DiceRollPresentation({
  onRollRevealed,
  pending = false,
  roll
}: {
  onRollRevealed: (rollId: string) => void
  pending?: boolean
  roll?: RollResultDto
}) {
  const [preferences] = useDicePresentationPreferences()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const [rendererFailed, setRendererFailed] = useState(false)
  const [canvasMounted, setCanvasMounted] = useState(false)
  const [readyRollId, setReadyRollId] = useState<string>()
  const [webGLAvailable, setWebGLAvailable] = useState<boolean>()
  const [revealedRollId, setRevealedRollId] = useState<string>()
  const rollFitsCanvas = roll ? getVisualDiceCount(roll) <= MAX_3D_DICE : false
  const needsWebGL =
    (Boolean(roll) || pending) &&
    preferences.animate3d &&
    !reducedMotion &&
    !rendererFailed &&
    (!roll || rollFitsCanvas)
  const canAnimate =
    preferences.animate3d && !reducedMotion && !rendererFailed && webGLAvailable === true
  const animatedRoll =
    canAnimate && rollFitsCanvas && roll?.id !== revealedRollId ? roll : undefined
  const waitingForWebGL = needsWebGL && webGLAvailable == null
  const revealRoll = useCallback(
    (rollId: string) => {
      if (revealedRollId === rollId) return
      setRevealedRollId(rollId)
      onRollRevealed(rollId)
    },
    [onRollRevealed, revealedRollId]
  )

  useEffect(() => {
    if (needsWebGL && webGLAvailable == null) setWebGLAvailable(supportsWebGL())
  }, [needsWebGL, webGLAvailable])

  useEffect(() => {
    if (canAnimate && (animatedRoll || pending)) setCanvasMounted(true)
  }, [animatedRoll, canAnimate, pending])

  useEffect(() => {
    if (!animatedRoll || readyRollId === animatedRoll.id) return
    const timeout = window.setTimeout(() => setRendererFailed(true), DICE_LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [animatedRoll, readyRollId])

  useEffect(() => {
    if (roll && roll.id !== revealedRollId && !animatedRoll && !waitingForWebGL) {
      revealRoll(roll.id)
    }
  }, [animatedRoll, revealRoll, revealedRollId, roll, waitingForWebGL])

  const fallback = roll ? <StaticDiceResult roll={roll} /> : null
  if (waitingForWebGL) return null
  if (rendererFailed) return fallback
  if (!canvasMounted && !animatedRoll) return fallback

  return (
    <DiceCanvasErrorBoundary fallback={fallback} onError={() => setRendererFailed(true)}>
      <Suspense fallback={null}>
        <DiceCanvas
          onReady={setReadyRollId}
          onRollSettled={revealRoll}
          preferences={preferences}
          roll={animatedRoll}
          staticFallback={fallback}
        />
        {roll && !animatedRoll ? fallback : null}
      </Suspense>
    </DiceCanvasErrorBoundary>
  )
}
