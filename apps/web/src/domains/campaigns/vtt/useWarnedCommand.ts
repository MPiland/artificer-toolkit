import { useEffect, useState } from 'react'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { LiveSessionCommandRejectedError } from './liveSessionClient'

/**
 * One list of actions that each send a command: tracks the row being sent, the rule warnings a
 * refusal raised for "Do it anyway", and the outcome message. The state resets when `resetKey` changes.
 */
export function useWarnedCommand(resetKey: string) {
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{
    id: string
    warnings: EncounterRuleWarningDto[]
  } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setConfirming(null)
    setFeedback(null)
    setError(null)
  }, [resetKey])

  async function run<Result>(
    id: string,
    send: () => Promise<Result>,
    messages: { done: string | ((result: Result) => string); failed: string }
  ) {
    setConfirming(null)
    setFeedback(null)
    setError(null)
    setSubmittingId(id)
    try {
      const result = await send()
      setFeedback(typeof messages.done === 'string' ? messages.done : messages.done(result))
    } catch (nextError) {
      if (nextError instanceof LiveSessionCommandRejectedError && nextError.rejection.warnings)
        setConfirming({ id, warnings: nextError.rejection.warnings })
      else setError(nextError instanceof Error ? nextError.message : messages.failed)
    } finally {
      setSubmittingId(null)
    }
  }

  return {
    submittingId,
    confirming,
    feedback,
    error,
    run,
    cancelConfirmation: () => setConfirming(null)
  }
}
