import type { ReactNode } from 'react'
import type { CharacterSheetRollRequest, CharacterSheetRollTarget } from './dice.types'
import { splitRollText } from './dice.utils'
import { useCharacterSheetRoll } from './rollContext'
import * as diceStyles from './dice.css'

export function CharacterSheetRollValue({
  children,
  request
}: {
  children: ReactNode
  request: CharacterSheetRollRequest
}) {
  const controller = useCharacterSheetRoll()
  if (!controller) return <>{children}</>
  const { executeRoll, pending, pendingRequest } = controller
  const rolling =
    pending &&
    pendingRequest?.expression === request.expression &&
    pendingRequest.rollMode === request.rollMode &&
    pendingRequest.source.kind === request.source.kind &&
    pendingRequest.source.label === request.source.label

  return (
    <button
      aria-busy={rolling}
      aria-label={`Roll ${request.source.label}: ${request.expression}`}
      className={diceStyles.rollValue}
      data-roll-target='true'
      data-rolling={rolling ? 'true' : undefined}
      disabled={pending}
      title={`Roll ${request.source.label}`}
      type='button'
      onClick={(event) => {
        event.stopPropagation()
        void executeRoll(request)
      }}
    >
      {children}
    </button>
  )
}

export function CharacterSheetRollText({
  targets,
  text
}: {
  targets: readonly CharacterSheetRollTarget[]
  text: string
}) {
  const controller = useCharacterSheetRoll()
  if (!controller) return <>{text}</>

  return (
    <>
      {splitRollText(text, targets).map((part, index) =>
        part.target ? (
          <CharacterSheetRollValue key={`${part.text}:${index}`} request={part.target}>
            {part.text}
          </CharacterSheetRollValue>
        ) : (
          <span key={`${part.text}:${index}`}>{part.text}</span>
        )
      )}
    </>
  )
}
