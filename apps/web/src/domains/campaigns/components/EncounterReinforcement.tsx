import { Alert, Button, Group, Modal, NumberInput, Select, Stack, TextInput } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useConvex } from 'convex/react'
import { useState } from 'react'
import { loadPagedAuthoredCatalogItems } from '#app/data/authoredCatalogPages'
import { queryKeys } from '#app/lib/queryKeys'
import * as sharedStyles from '../campaigns.css'
import type { EncounterCommandPayload } from './encounterWorkspace.types'

export function EncounterReinforcement({
  opened,
  disabled,
  submitting,
  sideRoll,
  onClose,
  onCommand
}: {
  opened: boolean
  disabled: boolean
  submitting: boolean
  sideRoll: boolean
  onClose: () => void
  onCommand: (command: Extract<EncounterCommandPayload, { type: 'REINFORCE' }>) => void
}) {
  const convex = useConvex()
  const [kind, setKind] = useState<'CREATURE' | 'CUSTOM'>('CREATURE')
  const [creatureId, setCreatureId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [hitPoints, setHitPoints] = useState(10)
  const [initiative, setInitiative] = useState<number | null>(null)
  const creatures = useQuery({
    enabled: opened && kind === 'CREATURE',
    queryKey: queryKeys.content.creatures.list(),
    queryFn: () =>
      loadPagedAuthoredCatalogItems(
        (input) => convex.query(convexApi.content.catalogue.list, input),
        {
          subjectKind: 'CREATURE',
          sort: 'name',
          paginationOpts: { cursor: null, numItems: 48 }
        }
      )
  })
  const validEnemy = kind === 'CREATURE' ? creatureId !== null : label.trim().length > 0

  return (
    <Modal centered opened={opened} title='Add enemy' onClose={onClose}>
      <Stack gap='md'>
        <Select
          data={[
            { value: 'CREATURE', label: 'Bestiary creature' },
            { value: 'CUSTOM', label: 'Custom enemy' }
          ]}
          disabled={submitting}
          label='Enemy type'
          value={kind}
          onChange={(value) => {
            if (value === 'CREATURE' || value === 'CUSTOM') setKind(value)
          }}
        />
        {kind === 'CREATURE' ? (
          <>
            <Select
              classNames={{ input: sharedStyles.input }}
              data={(creatures.data ?? []).map((creature) => ({
                value: creature.id,
                label: creature.label
              }))}
              disabled={submitting || creatures.isPending}
              label='Bestiary creature'
              searchable
              value={creatureId}
              onChange={setCreatureId}
            />
            {creatures.error ? <Alert color='red'>Creatures couldn’t be loaded.</Alert> : null}
          </>
        ) : (
          <>
            <TextInput
              classNames={{ input: sharedStyles.input }}
              disabled={submitting}
              label='Custom enemy name'
              maxLength={160}
              value={label}
              onChange={(event) => setLabel(event.currentTarget.value)}
            />
            <NumberInput
              allowDecimal={false}
              classNames={{ input: sharedStyles.input }}
              disabled={submitting}
              label='Max HP'
              min={0}
              value={hitPoints}
              onChange={(value) => setHitPoints(Number(value) || 0)}
            />
          </>
        )}
        <NumberInput
          allowDecimal={false}
          classNames={{ input: sharedStyles.input }}
          description={
            sideRoll
              ? 'An existing enemy side keeps its initiative. Enter a score for an enemy side joining again.'
              : 'Joins this round if its place is after the current turn; otherwise next round.'
          }
          disabled={submitting}
          label='Initiative'
          value={initiative ?? ''}
          onChange={(value) => setInitiative(typeof value === 'number' ? value : null)}
        />
        <Group justify='flex-end'>
          <Button disabled={submitting} variant='default' onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={disabled || !validEnemy || initiative === null}
            loading={submitting}
            onClick={() => {
              if (initiative === null) return
              const enemy =
                kind === 'CREATURE' && creatureId
                  ? { kind: 'CREATURE' as const, sourceId: creatureId }
                  : kind === 'CUSTOM'
                    ? { kind: 'CUSTOM' as const, label: label.trim(), maxHitPoints: hitPoints }
                    : null
              if (enemy) onCommand({ type: 'REINFORCE', enemy, initiative, public: true })
            }}
          >
            Add enemy
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
