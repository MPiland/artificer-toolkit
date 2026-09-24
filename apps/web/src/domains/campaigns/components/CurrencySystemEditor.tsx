import {
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Select,
  Stack,
  TextInput
} from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useState } from 'react'
import type {
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import * as sharedStyles from '../campaigns.css'
import * as settingsStyles from './campaignSettings.css'

type DenominationDraft = SaveCampaignCurrencySystemInput['denominations'][number]

export function CurrencySystemEditor({
  campaignId,
  systems
}: {
  campaignId: string
  systems: CurrencySystemDto[]
}) {
  const saveSystem = useConvexMutation(convexApi.campaigns.currencySystems.save)
  const removeSystem = useConvexMutation(convexApi.campaigns.currencySystems.remove)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [isReference, setIsReference] = useState(false)
  const [denominations, setDenominations] = useState<DenominationDraft[]>([
    { label: 'Gold', abbreviation: 'gp', scaleInReference: 1 }
  ])
  const [validationError, setValidationError] = useState<string | null>(null)
  const selected = systems.find((system) => system.id === selectedId)
  const save = useMutation({
    mutationFn: () => {
      if (denominations.filter((denomination) => denomination.scaleInReference === 1).length !== 1)
        throw new Error('Exactly one denomination must use scale 1.')
      return saveSystem({
        campaignId,
        systemId: selected?.id,
        expectedVersion: selected?.version,
        label,
        isReference,
        denominations
      })
    },
    onSuccess: (system) => {
      setSelectedId(system.id)
      setValidationError(null)
    },
    onError: (error) => setValidationError(error.message)
  })
  const remove = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Choose a currency system to delete.')
      return removeSystem({ campaignId, systemId: selected.id, expectedVersion: selected.version })
    },
    onSuccess: reset,
    onError: (error) => setValidationError(error.message)
  })

  const pending = save.isPending || remove.isPending

  function reset() {
    setSelectedId(null)
    setLabel('')
    setIsReference(false)
    setDenominations([{ label: 'Gold', abbreviation: 'gp', scaleInReference: 1 }])
    setValidationError(null)
  }

  function selectSystem(systemId: string | null) {
    const system = systems.find((item) => item.id === systemId)
    if (!system) return reset()
    setSelectedId(system.id)
    setLabel(system.label)
    setIsReference(system.isReference)
    setDenominations(
      system.denominations.map(
        ({ id, label: denominationLabel, abbreviation, scaleInReference }) => ({
          id,
          label: denominationLabel,
          abbreviation,
          scaleInReference
        })
      )
    )
    setValidationError(null)
  }

  function updateDenomination(index: number, patch: Partial<DenominationDraft>) {
    setDenominations((current) =>
      current.map((denomination, itemIndex) =>
        itemIndex === index ? { ...denomination, ...patch } : denomination
      )
    )
  }

  return (
    <Stack gap='sm'>
      <Select
        disabled={pending}
        clearable
        classNames={{ input: sharedStyles.input }}
        data={systems.map((system) => ({
          value: system.id,
          label: system.label
        }))}
        label='Edit currency system'
        placeholder='Create a new system'
        value={selectedId}
        onChange={selectSystem}
      />
      {validationError ? <Alert color='red'>{validationError}</Alert> : null}
      <TextInput
        disabled={pending}
        label='System name'
        classNames={{ input: sharedStyles.input }}
        required
        value={label}
        onChange={(event) => setLabel(event.currentTarget.value)}
      />
      <Checkbox
        disabled={pending}
        checked={isReference}
        label='Reference system'
        onChange={(event) => setIsReference(event.currentTarget.checked)}
      />
      {denominations.map((denomination, index) => (
        <div className={settingsStyles.denominationGrid} key={denomination.id ?? index}>
          <TextInput
            disabled={pending}
            label='Denomination'
            classNames={{ input: sharedStyles.input }}
            value={denomination.label}
            onChange={(event) => updateDenomination(index, { label: event.currentTarget.value })}
          />
          <TextInput
            disabled={pending}
            label='Abbreviation'
            classNames={{ input: sharedStyles.input }}
            value={denomination.abbreviation}
            onChange={(event) =>
              updateDenomination(index, {
                abbreviation: event.currentTarget.value
              })
            }
          />
          <NumberInput
            disabled={pending}
            label='Scale'
            classNames={{ input: sharedStyles.input }}
            min={1}
            step={1}
            value={denomination.scaleInReference}
            onChange={(value) =>
              updateDenomination(index, {
                scaleInReference: Number(value) || 1
              })
            }
          />
          <Button
            disabled={pending || denominations.length === 1}
            variant='subtle'
            onClick={() =>
              setDenominations((current) => current.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            Remove
          </Button>
        </div>
      ))}
      <Group>
        <Button
          disabled={pending || denominations.length >= 5}
          variant='default'
          onClick={() =>
            setDenominations((current) => [
              ...current,
              { label: '', abbreviation: '', scaleInReference: 10 }
            ])
          }
        >
          Add denomination
        </Button>
        <Button
          disabled={pending || !label.trim() || Boolean(selectedId && !selected)}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save system
        </Button>
        {selected ? (
          <Button
            color='red'
            disabled={pending}
            loading={remove.isPending}
            variant='subtle'
            onClick={() => remove.mutate()}
          >
            Delete system
          </Button>
        ) : null}
      </Group>
    </Stack>
  )
}
