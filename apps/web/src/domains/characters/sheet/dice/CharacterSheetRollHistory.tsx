import { Button, Drawer, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { type ComponentProps, useEffect, useRef, useState } from 'react'
import { getRollHistory, useClearRollHistoryMutation } from '#app/data/rolls'
import { CharacterSheetRollReveal } from './CharacterSheetRollReveal'
import { formatRollEvidence } from '#app/components/dice/dice.utils'
import * as diceStyles from './dice.css'

export function CharacterSheetRollHistory({
  opened,
  pendingRollId,
  rollerName,
  onClose,
  onRevealRoll
}: {
  opened: boolean
  pendingRollId?: string
  rollerName: string
  onClose: () => void
  onRevealRoll: ComponentProps<typeof CharacterSheetRollReveal>['onReveal']
}) {
  const history = useQuery(getRollHistory(opened))
  const clearHistory = useClearRollHistoryMutation()
  const [confirmingClear, setConfirmingClear] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const rolls = history.data
    ? history.data.filter((roll) => roll.id !== pendingRollId).reverse()
    : []

  if (!opened && confirmingClear) setConfirmingClear(false)

  useEffect(() => {
    if (!opened || !history.data) return
    const messages = messagesRef.current
    if (messages) messages.scrollTop = messages.scrollHeight
  }, [history.data, opened, pendingRollId])

  return (
    <Drawer
      classNames={{ body: diceStyles.historyBody }}
      opened={opened}
      position='right'
      size='sm'
      title='Roll history'
      onClose={onClose}
    >
      <div className={diceStyles.historyToolbar}>
        {confirmingClear ? (
          <>
            <Text size='sm'>Clear all roll history?</Text>
            <div className={diceStyles.historyConfirmActions}>
              <Button size='xs' variant='default' onClick={() => setConfirmingClear(false)}>
                Cancel
              </Button>
              <Button
                color='red'
                loading={clearHistory.isPending}
                size='xs'
                onClick={() =>
                  clearHistory.mutate(undefined, {
                    onSuccess: () => setConfirmingClear(false)
                  })
                }
              >
                Clear
              </Button>
            </div>
          </>
        ) : (
          <Button
            disabled={!history.data?.length}
            size='xs'
            variant='subtle'
            onClick={() => setConfirmingClear(true)}
          >
            Clear history
          </Button>
        )}
      </div>

      <div className={diceStyles.historyMessages} aria-live='polite' ref={messagesRef}>
        {clearHistory.isError ? (
          <Text c='red' role='alert'>
            Roll history could not be cleared.
          </Text>
        ) : null}
        {history.isPending ? <Text c='dimmed'>Loading rolls…</Text> : null}
        {history.isError ? (
          <Text c='red' role='alert'>
            Roll history could not be loaded.
          </Text>
        ) : null}
        {!history.isPending && !rolls.length ? <Text c='dimmed'>No rolls yet.</Text> : null}
        {rolls.map((roll) => (
          <article className={diceStyles.historyMessage} key={roll.id}>
            <Text className={diceStyles.historyAuthor}>{rollerName}</Text>
            <div className={diceStyles.historyBubble}>
              <Text className={diceStyles.historyTotal}>Rolled {roll.evidence.total}</Text>
              <Text className={diceStyles.historyEvidence}>
                {formatRollEvidence(roll.evidence)}
              </Text>
              <Text className={diceStyles.historyMeta}>
                {roll.source.label} · {roll.characterLabel} ·{' '}
                {new Intl.DateTimeFormat(undefined, {
                  hour: 'numeric',
                  minute: '2-digit'
                }).format(new Date(roll.createdAt))}
              </Text>
              <CharacterSheetRollReveal roll={roll} onReveal={onRevealRoll} />
            </div>
          </article>
        ))}
      </div>
    </Drawer>
  )
}
