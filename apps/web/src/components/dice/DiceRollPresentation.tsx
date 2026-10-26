import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { useHydrated } from '@tanstack/react-router'
import { formatD20FoldedBonus } from '@artificer-toolkit/schema/shared/d20FoldedBonuses'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import {
  formatModeChange,
  formatRollEvidence,
  getVisualDiceCount,
  MAX_3D_DICE,
  MODE_CHANGE_ANIMATION_MS,
  supportsWebGL,
  type DicePresentationRoll
} from './dice.utils'
import { DiceCanvasErrorBoundary } from './DiceCanvasErrorBoundary'
import * as diceStyles from './dice.css'

const DiceCanvas = lazy(() => import('./DiceCanvas'))
const DICE_LOAD_TIMEOUT_MS = 10_000
/** Rolls whose mode change already played here, so a card shown again does not replay it. */
const animatedModeChangeRollIds = new Set<string>()

function StaticDiceResult({
  reducedMotion,
  roll
}: {
  reducedMotion: boolean
  roll: DicePresentationRoll
}) {
  const adjustment = roll.ruleCheck?.kind === 'D20_MODE_ADJUSTED' ? roll.ruleCheck : undefined
  const [playing, setPlaying] = useState(
    () => Boolean(adjustment) && !reducedMotion && !animatedModeChangeRollIds.has(roll.id)
  )
  useEffect(() => {
    if (!playing) return
    animatedModeChangeRollIds.add(roll.id)
    const timeout = window.setTimeout(() => setPlaying(false), MODE_CHANGE_ANIMATION_MS)
    return () => window.clearTimeout(timeout)
  }, [playing, roll.id])
  return (
    <div
      className={diceStyles.staticDiceOverlay}
      aria-live='polite'
      data-mode-change={playing ? 'playing' : undefined}
    >
      <div className={diceStyles.staticDiceList}>
        {roll.evidence.terms.flatMap((term, termIndex) =>
          term.rolls.map((value, rollIndex) => {
            // The adjustment names the d20's rolls, the first term; added dice (D156) follow it.
            const termAdjustment = termIndex === 0 ? adjustment : undefined
            const cancelled = Boolean(termAdjustment?.cancelledRollIndexes.includes(rollIndex))
            const added = Boolean(termAdjustment?.addedRollIndexes.includes(rollIndex))
            const kept = term.keptRollIndexes
              ? term.keptRollIndexes.includes(rollIndex)
              : term.keptRollIndex == null || term.keptRollIndex === rollIndex
            return (
              <span
                className={diceStyles.staticDie}
                data-added={added ? 'true' : undefined}
                data-cancelled={cancelled ? 'true' : undefined}
                data-kept={kept && !cancelled ? 'true' : undefined}
                key={`${termIndex}:${rollIndex}`}
              >
                <small>
                  {term.subtracted ? '−' : ''}d{term.die}
                  {cancelled
                    ? ''
                    : term.keptRollIndex == null
                      ? ''
                      : kept
                        ? ' · kept'
                        : ' · dropped'}
                  {term.keptRollIndexes ? (kept ? ' · kept' : ' · dropped') : ''}
                </small>
                <strong>{value}</strong>
                {added ? <small>added</small> : null}
                {cancelled ? (
                  <span aria-label='cancelled' className={diceStyles.cancelledMark} role='img'>
                    ✕
                  </span>
                ) : null}
              </span>
            )
          })
        )}
      </div>
      {adjustment ? (
        <span className={diceStyles.staticDiceCaption}>
          <strong>{formatModeChange(adjustment)}</strong>
        </span>
      ) : null}
      {adjustment?.caption ? (
        <span className={diceStyles.staticDiceCaption}>{adjustment.caption}</span>
      ) : null}
      <div className={diceStyles.staticRollSummary}>
        <strong>Rolled {roll.evidence.total}</strong>
        <span>{formatRollEvidence(roll.evidence)}</span>
        {roll.foldedBonuses?.map((bonus) => (
          <span key={`${bonus.operand}:${bonus.label}`}>{formatD20FoldedBonus(bonus)}</span>
        ))}
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
  roll?: DicePresentationRoll
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
  const hydrated = useHydrated()
  const notifiedRollIdRef = useRef<string | undefined>(undefined)

  // The probe needs the browser, so it waits for hydration to keep the first client render equal
  // to the server's.
  if (hydrated && needsWebGL && webGLAvailable == null) setWebGLAvailable(supportsWebGL())

  if (!canvasMounted && canAnimate && (animatedRoll || pending)) setCanvasMounted(true)

  // A roll with no animation to wait for is revealed as soon as it can be shown.
  if (roll && roll.id !== revealedRollId && !animatedRoll && !waitingForWebGL)
    setRevealedRollId(roll.id)

  useEffect(() => {
    if (!revealedRollId || notifiedRollIdRef.current === revealedRollId) return
    notifiedRollIdRef.current = revealedRollId
    onRollRevealed(revealedRollId)
  }, [onRollRevealed, revealedRollId])

  useEffect(() => {
    if (!animatedRoll || readyRollId === animatedRoll.id) return
    const timeout = window.setTimeout(() => setRendererFailed(true), DICE_LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [animatedRoll, readyRollId])

  const fallback = roll ? <StaticDiceResult reducedMotion={reducedMotion} roll={roll} /> : null
  if (waitingForWebGL) return null
  if (rendererFailed) return fallback
  if (!canvasMounted && !animatedRoll) return fallback

  return (
    <DiceCanvasErrorBoundary fallback={fallback} onError={() => setRendererFailed(true)}>
      <Suspense fallback={null}>
        <DiceCanvas
          onReady={setReadyRollId}
          onRollSettled={setRevealedRollId}
          preferences={preferences}
          roll={animatedRoll}
          staticFallback={fallback}
        />
        {roll && !animatedRoll ? fallback : null}
      </Suspense>
    </DiceCanvasErrorBoundary>
  )
}
