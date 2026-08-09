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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CurrencySystemDto, SaveCampaignCurrencySystemInput } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from '../campaigns.css'

type DenominationDraft = SaveCampaignCurrencySystemInput['denominations'][number]

export function CurrencySystemEditor({
  campaignId,
  systems
}: {
  campaignId: string
  systems: CurrencySystemDto[]
}) {
  const queryClient = useQueryClient()
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
      return api.campaigns.inventory.saveCurrencySystem({
        campaignId,
        systemId: selected?.id,
        expectedVersion: selected?.version,
        label,
        isReference,
        denominations
      })
    },
    onSuccess: async (system) => {
      setSelectedId(system.id)
      setValidationError(null)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.currencySystems(campaignId)
      })
    },
    onError: (error) => setValidationError(error.message)
  })
  const remove = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Choose a currency system to delete.')
      return api.campaigns.inventory.deleteCurrencySystem(campaignId, selected.id, selected.version)
    },
    onSuccess: async () => {
      reset()
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.currencySystems(campaignId)
      })
    }
  })

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
        clearable
        classNames={{ input: styles.input }}
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
        label='System name'
        classNames={{ input: styles.input }}
        required
        value={label}
        onChange={(event) => setLabel(event.currentTarget.value)}
      />
      <Checkbox
        checked={isReference}
        label='Reference system'
        onChange={(event) => setIsReference(event.currentTarget.checked)}
      />
      {denominations.map((denomination, index) => (
        <div className={styles.denominationGrid} key={denomination.id ?? index}>
          <TextInput
            label='Denomination'
            classNames={{ input: styles.input }}
            value={denomination.label}
            onChange={(event) => updateDenomination(index, { label: event.currentTarget.value })}
          />
          <TextInput
            label='Abbreviation'
            classNames={{ input: styles.input }}
            value={denomination.abbreviation}
            onChange={(event) =>
              updateDenomination(index, {
                abbreviation: event.currentTarget.value
              })
            }
          />
          <NumberInput
            label='Scale'
            classNames={{ input: styles.input }}
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
            disabled={denominations.length === 1}
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
          disabled={denominations.length >= 5}
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
        <Button disabled={!label.trim()} loading={save.isPending} onClick={() => save.mutate()}>
          Save system
        </Button>
        {selected ? (
          <Button
            color='red'
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
