import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { withForm } from '#forms/app-form/AppForm'
import { AppSelect } from '#ui/primitives/Select'
import { choiceOptions } from '../../choices/choiceOptions'
import { createFallbackCharacterFormValues } from '../../shared/formNormalization'
import type { CharacterFormValues } from '../../core/characterBuilder.types'
import * as sharedStyles from '../../shared/builderShared.css'
import * as styles from './characterEquipment.css'
import { CharacterStartingEquipmentChoices } from './CharacterStartingEquipmentChoices'
import type { CharacterBuilderStepProps } from '../../core/CharacterBuilderStep.types'

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
      <div className={sharedStyles.section}>
        {classStartingEquipment ? (
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
        ) : null}
        {backgroundStartingEquipment ? (
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
        ) : null}
        <form.AppField name='state.equipment.inventory' mode='array'>
          {(field) => {
            const rows = field.state.value ?? []

            return (
              <Stack gap='md' className={sharedStyles.inlinePanel}>
                <Group className={styles.manualPanelHeader}>
                  <Text fw={700}>Manual inventory</Text>
                  {!readOnly ? (
                    <Button
                      type='button'
                      size='compact-sm'
                      variant='default'
                      onClick={() => field.pushValue(createInventoryItem())}
                    >
                      Add Item
                    </Button>
                  ) : null}
                </Group>
                {rows.length === 0 ? (
                  <Text className={sharedStyles.mutedText}>
                    No manual inventory has been added.
                  </Text>
                ) : (
                  rows.map((row, index) => (
                    <div key={row.id} className={styles.manualInventoryRow}>
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
                      {!readOnly ? (
                        <Tooltip label='Remove item'>
                          <ActionIcon
                            aria-label={`Remove inventory item ${index + 1}`}
                            type='button'
                            variant='subtle'
                            color='red'
                            onClick={() => field.removeValue(index)}
                          >
                            <IconTrash aria-hidden size={17} />
                          </ActionIcon>
                        </Tooltip>
                      ) : null}
                    </div>
                  ))
                )}
              </Stack>
            )
          }}
        </form.AppField>
        <form.AppField name='state.currency' mode='array'>
          {(field) => {
            const rows = field.state.value ?? []

            return (
              <Stack gap='md' className={sharedStyles.inlinePanel}>
                <Group className={styles.manualPanelHeader}>
                  <Text fw={700}>Manual currency</Text>
                  {!readOnly ? (
                    <Button
                      type='button'
                      size='compact-sm'
                      variant='default'
                      onClick={() => field.pushValue(createCurrencyGroup())}
                    >
                      Add Currency Group
                    </Button>
                  ) : null}
                </Group>
                {rows.length === 0 ? (
                  <Text className={sharedStyles.mutedText}>No manual currency has been added.</Text>
                ) : (
                  rows.map((row, index) => (
                    <div key={row.id} className={styles.manualCurrencyRow}>
                      <AppSelect
                        label='Currency'
                        data={currencyOptions}
                        value={row.currencies[0]?.currencyId ?? null}
                        disabled={readOnly}
                        onChange={(value) => {
                          if (!value) return
                          field.replaceValue(
                            index,
                            setFirstCurrency(row, {
                              kind: 'RULESET',
                              currencyId: value,
                              amount: row.currencies[0]?.amount ?? 0
                            })
                          )
                        }}
                      />
                      <NumberInput
                        hideControls
                        label='Amount'
                        value={row.currencies[0]?.amount ?? 0}
                        disabled={readOnly}
                        onChange={(value) => {
                          field.replaceValue(
                            index,
                            setFirstCurrency(row, {
                              ...(row.currencies[0] ?? { kind: 'RULESET', currencyId: '' }),
                              amount: typeof value === 'number' ? value : 0
                            })
                          )
                        }}
                      />
                      {!readOnly ? (
                        <Tooltip label='Remove currency'>
                          <ActionIcon
                            aria-label={`Remove currency group ${index + 1}`}
                            type='button'
                            variant='subtle'
                            color='red'
                            onClick={() => field.removeValue(index)}
                          >
                            <IconTrash aria-hidden size={17} />
                          </ActionIcon>
                        </Tooltip>
                      ) : null}
                    </div>
                  ))
                )}
              </Stack>
            )
          }}
        </form.AppField>
      </div>
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
    id: crypto.randomUUID(),
    currencies: [
      {
        kind: 'RULESET',
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
