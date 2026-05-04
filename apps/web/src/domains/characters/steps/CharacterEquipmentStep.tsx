import { Alert, Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import { withForm } from '#forms'
import { AppSelect } from '#ui/primitives/Select'
import {
  choiceOptions,
  createFallbackCharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import { CharacterStartingEquipmentChoices } from './CharacterStartingEquipmentChoices'
import type { CharacterFormValues } from '../characterBuilder.utils'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

type InventoryItem = CharacterFormValues['state']['equipment']['inventory'][number]
type CurrencyGroup = CharacterFormValues['state']['currency'][number]

export const CharacterEquipmentStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterEquipment({ form, payload, readOnly }) {
    const equipmentOptions = choiceOptions(payload.view.equipment.equipmentOptions)
    const currencyOptions = choiceOptions(payload.view.equipment.currencyOptions)
    const classStartingEquipment = payload.view.equipment.classStartingEquipment
    const backgroundStartingEquipment = payload.view.equipment.backgroundStartingEquipment

    return (
      <section className={styles.section} aria-labelledby='character-equipment-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-equipment-title' className={styles.sectionTitle}>Equipment & currency</h3>
        </div>
        {payload.view.equipment.classStartingEquipmentRequired || payload.view.equipment.backgroundStartingEquipmentRequired
          ? (
              <Alert color='yellow'>
                Starting equipment choices are still required from the selected class or background.
              </Alert>
            )
          : null}
        {classStartingEquipment
          ? (
              <form.AppField name='intent.startingEquipment.class'>
                {(field) => (
                  <CharacterStartingEquipmentChoices
                    view={classStartingEquipment}
                    decision={field.state.value}
                    equipmentOptions={payload.view.equipment.equipmentOptions}
                    currencyOptions={payload.view.equipment.currencyOptions}
                    readOnly={readOnly}
                    onChange={field.handleChange}
                  />
                )}
              </form.AppField>
            )
          : null}
        {backgroundStartingEquipment
          ? (
              <form.AppField name='intent.startingEquipment.background'>
                {(field) => (
                  <CharacterStartingEquipmentChoices
                    view={backgroundStartingEquipment}
                    decision={field.state.value}
                    equipmentOptions={payload.view.equipment.equipmentOptions}
                    currencyOptions={payload.view.equipment.currencyOptions}
                    readOnly={readOnly}
                    onChange={field.handleChange}
                  />
                )}
              </form.AppField>
            )
          : null}
        <form.AppField name='state.equipment.inventory' mode='array'>
          {(field) => {
            const rows = field.state.value ?? []

            return (
              <Stack gap='md' className={styles.inlinePanel}>
                <Group justify='space-between'>
                  <Text fw={700}>Manual inventory</Text>
                  {!readOnly
                    ? (
                        <Button
                          type='button'
                          variant='default'
                          onClick={() => field.pushValue(createInventoryItem())}
                        >
                          Add Item
                        </Button>
                      )
                    : null}
                </Group>
                {rows.length === 0
                  ? <Text className={styles.mutedText}>No manual inventory has been added.</Text>
                  : rows.map((row, index) => (
                      <Group key={row.id} align='flex-end'>
                        <AppSelect
                          label='Equipment'
                          data={equipmentOptions}
                          value={row.equipmentId}
                          disabled={readOnly}
                          onChange={(value) => {
                            field.replaceValue(index, {
                              ...row,
                              equipmentId: value ?? ''
                            })
                          }}
                        />
                        <NumberInput
                          hideControls
                          label='Quantity'
                          min={1}
                          value={row.quantity}
                          disabled={readOnly}
                          onChange={(value) => {
                            field.replaceValue(index, {
                              ...row,
                              quantity: typeof value === 'number' ? value : 1
                            })
                          }}
                        />
                        <TextInput
                          label='Custom Name'
                          value={row.customName ?? ''}
                          disabled={readOnly}
                          onChange={(event) => {
                            field.replaceValue(index, {
                              ...row,
                              customName: event.currentTarget.value || undefined
                            })
                          }}
                        />
                        {!readOnly
                          ? (
                              <Button type='button' variant='subtle' color='red' onClick={() => field.removeValue(index)}>
                                Remove
                              </Button>
                            )
                          : null}
                      </Group>
                    ))}
              </Stack>
            )
          }}
        </form.AppField>
        <form.AppField name='state.currency' mode='array'>
          {(field) => {
            const rows = field.state.value ?? []

            return (
              <Stack gap='md' className={styles.inlinePanel}>
                <Group justify='space-between'>
                  <Text fw={700}>Manual currency</Text>
                  {!readOnly
                    ? (
                        <Button
                          type='button'
                          variant='default'
                          onClick={() => field.pushValue(createCurrencyGroup())}
                        >
                          Add Currency Group
                        </Button>
                      )
                    : null}
                </Group>
                {rows.length === 0
                  ? <Text className={styles.mutedText}>No manual currency has been added.</Text>
                  : rows.map((row, index) => (
                      <Group key={`currency-${index}`} align='flex-end'>
                        <AppSelect
                          label='Currency'
                          data={currencyOptions}
                          value={row.currencies[0]?.currencyId ?? null}
                          disabled={readOnly}
                          onChange={(value) => {
                            field.replaceValue(index, setFirstCurrency(row, {
                              currencyId: value ?? '',
                              amount: row.currencies[0]?.amount ?? 0
                            }))
                          }}
                        />
                        <NumberInput
                          hideControls
                          label='Amount'
                          value={row.currencies[0]?.amount ?? 0}
                          disabled={readOnly}
                          onChange={(value) => {
                            field.replaceValue(index, setFirstCurrency(row, {
                              currencyId: row.currencies[0]?.currencyId ?? '',
                              amount: typeof value === 'number' ? value : 0
                            }))
                          }}
                        />
                        {!readOnly
                          ? (
                              <Button type='button' variant='subtle' color='red' onClick={() => field.removeValue(index)}>
                                Remove
                              </Button>
                            )
                          : null}
                      </Group>
                    ))}
              </Stack>
            )
          }}
        </form.AppField>
      </section>
    )
  }
})

function createInventoryItem(): InventoryItem {
  return {
    id: crypto.randomUUID(),
    equipmentId: '',
    quantity: 1
  }
}

function createCurrencyGroup(): CurrencyGroup {
  return {
    currencies: [
      {
        currencyId: '',
        amount: 0
      }
    ]
  }
}

function setFirstCurrency(
  group: CurrencyGroup,
  currency: CurrencyGroup['currencies'][number]
): CurrencyGroup {
  return {
    ...group,
    currencies: [currency]
  }
}
