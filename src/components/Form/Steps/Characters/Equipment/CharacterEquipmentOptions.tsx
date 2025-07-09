import { use } from 'react'
import { Attributes, Currencies, StartingEquipOptions } from '@/enums'
import { sprinkles } from '@/css/sprinkles.css'
import { Grid, Button } from '@mantine/core'
import { ModalContext } from '@/components/Modal'
import { v4 as uuid } from 'uuid'
import { useEquipmentData } from '@/hooks'
import type { Background, CharacterEquipmentInput, CharacterInput, Class } from '@/types'
import { useFormStore } from '@/store'
import { withFieldGroup, CharacterEquipmentSelection } from '@/components/Form'
import {
  BackgroundStartingEquipmentInputSchema,
  CharacterEquipmentObjectInputSchema,
  ClassStartingEquipmentInputSchema,
  CharacterEquipmentInputSchema,
} from '@/schemas'
import { useStore } from '@tanstack/react-form'

type CharacterEquipmentOptionsProps = {
  dataSource?: Class | Background
}

const defaultValues: {
  equipment?: CharacterInput['classEquipment'] | CharacterInput['backgroundEquipment']
  currencyGroups?: CharacterInput['currencyGroups']
  characterInventory?: CharacterInput['equipment']['inventory']
} = {
  equipment: undefined,
  currencyGroups: undefined,
}

const CharacterEquipmentOptions = withFieldGroup({
  defaultValues,
  props: {
    dataSource: undefined,
  } as CharacterEquipmentOptionsProps,
  render: function Render({ group, dataSource }) {
    const formStore = useFormStore()

    const { showModal } = use(ModalContext)

    const { equipment } = useEquipmentData()

    const path = dataSource?.__typename === 'Class' ? 'classEquipment' : 'backgroundEquipment'

    const { option, addedToCharacter, totalGold, equipmentGroups, formEquipment, currencyGroups } = useStore(
      group.store,
      (state) => ({
        option:
          state.values?.equipment?.__kind === 'ClassStartingEquipmentInput' ?
            state.values?.equipment?.option
          : undefined,
        addedToCharacter: state.values?.equipment?.addedToCharacter,
        totalGold:
          state.values?.equipment?.__kind === 'ClassStartingEquipmentInput' ?
            state.values?.equipment?.totalGold
          : undefined,
        equipmentGroups: state.values?.equipment?.equipmentGroups,
        formEquipment: state.values?.equipment,
        currencyGroups: state.values?.currencyGroups,
      })
    )

    // Check if all required equipment selections are complete or gold is ready
    const isEquipmentSelectionComplete = (): boolean => {
      // Check if a starting equipment option has been selected at all
      if (dataSource?.__typename === 'Class' && (!option || addedToCharacter)) return false

      // For gold option, check if totalGold has been generated
      if (dataSource?.__typename === 'Class' && option === StartingEquipOptions.GOLD) {
        if (!totalGold && totalGold !== 0) return false
      }

      // For equipment option, check if all selections are complete
      if (
        (dataSource?.__typename === 'Class' && option === StartingEquipOptions.EQUIPMENT) ||
        dataSource?.__typename === 'Background'
      ) {
        // If no primaryClass or no equipment structure, return false
        if (!dataSource?.equipment) return false

        // For each equipment group in the class
        for (let groupIndex = 0; groupIndex < dataSource?.equipment.length; groupIndex++) {
          const groupId = groupIndex.toString()

          // Find if this group has a selection
          const groupSelection = equipmentGroups?.find((g) => g.groupId === groupId)

          // If no selection for this group, return false
          if (!groupSelection || groupSelection.optionId === undefined) {
            return false
          }

          // Get the selected option structure
          const optionIndex = Number(groupSelection.optionId)

          if (optionIndex === -1) return false

          const selectedOptionStructure = dataSource?.equipment?.[groupIndex]?.[optionIndex]

          if (!selectedOptionStructure) return false

          // Check each item in the selected option structure that requires choices
          for (let itemIndex = 0; itemIndex < selectedOptionStructure.length; itemIndex++) {
            const item = selectedOptionStructure[itemIndex]

            // Skip items that don't provide options
            if (!item.attributes?.includes(Attributes.PROVIDES_OPTIONS)) {
              continue
            }

            const selectionCount = Number(item.selectionCount) || 1

            // Check if all required selections for this item exist
            for (let selIndex = 0; selIndex < selectionCount; selIndex++) {
              const selectionId = `${itemIndex}-${selIndex}`

              // Look for this specific selection in the group's equipment
              const hasSelection = groupSelection?.equipment?.some((e) => e.selectionId === selectionId && !!e.id)

              if (!hasSelection) {
                return false
              }
            }
          }
        }

        // If we get here, all required selections are complete
        return true
      }

      return false
    }

    const handleAddEquipment = () => {
      if (dataSource?.__typename === 'Class' && option === StartingEquipOptions.GOLD) {
        const currencyGroupIndex = currencyGroups?.findIndex((group) => group.container == null)
        const baglessIndex = currencyGroupIndex && currencyGroupIndex !== -1 ? currencyGroupIndex : 0

        const currencyIndex = currencyGroups?.[baglessIndex]?.currencies?.findIndex(
          (currency) => currency?.id === Currencies.GOLD
        )
        const baglessCurrencyIndex = currencyIndex && currencyIndex !== -1 ? currencyIndex : 0

        group.setFieldValue(`currencyGroups[${baglessIndex}].currencies[${baglessCurrencyIndex}].amount`, totalGold)

        formStore.updateField({
          path: `currencyGroups[${baglessIndex}].currencies.${baglessCurrencyIndex}.amount`,
          value: totalGold,
        })
        formStore.updateField({
          path: 'classEquipment.addedToCharacter',
          value: true,
        })
      }
      if (
        (dataSource?.__typename === 'Class' && option === StartingEquipOptions.EQUIPMENT) ||
        dataSource?.__typename === 'Background'
      ) {
        const equipmentArray = [] as NonNullable<CharacterEquipmentInput['inventory']>
        equipmentGroups?.forEach((group) => {
          if (group?.equipment?.length) {
            group?.equipment?.forEach((gE) => {
              const fullEquipment = equipment.findEquipment(gE.id)
              if (fullEquipment) {
                const equipObj = CharacterEquipmentObjectInputSchema.parse({
                  id: uuid(),
                  equipmentId: gE.id,
                  quantity: gE.quantity,
                })
                equipmentArray?.push(equipObj)
              }
            })
          }
        })

        group.setFieldValue('equipment.addedToCharacter', true)
        formStore.updateField({
          path: 'equipment.inventory',
          value: equipmentArray,
        })
        formStore.updateField({
          path: `${path}.addedToCharacter`,
          value: true,
        })
      }
    }

    const resetEquipment = () => {
      formStore.updateField({
        path: 'equipment',
        value: CharacterEquipmentInputSchema.parse({
          ...equipment,
          inventory: [],
        }),
      })
      formStore.updateField({
        path: 'currencyGroups',
        value: [],
      })
      group.setFieldValue('currencyGroups', [])
      if (dataSource?.__typename === 'Class') {
        const classEquipmentObject = ClassStartingEquipmentInputSchema.parse({
          ...formEquipment,
          equipmentGroups: [],
          addedToCharacter: false,
          option: '',
          totalGold: 0,
        })
        group.setFieldValue('equipment', classEquipmentObject)
        formStore.updateField({ path: 'classEquipment', value: classEquipmentObject })
      } else {
        const backgroundEquipmentObject = BackgroundStartingEquipmentInputSchema.parse({
          ...formEquipment,
          equipmentGroups: [],
          addedToCharacter: false,
        })
        group.setFieldValue('equipment', backgroundEquipmentObject)
        formStore.updateField({ path: 'backgroundEquipment', value: backgroundEquipmentObject })
      }
    }

    const handleResetEquipment = () => {
      showModal({
        type: 'alert',
        props: {
          message:
            'WARNING: Resetting equipment will remove all current equipment and currency from your character. Are you sure you want to continue?',
          onConfirm: resetEquipment,
        },
      })
    }

    return (
      <>
        {dataSource?.equipment?.map((g, i) => {
          if (g?.length) {
            if (dataSource?.__typename === 'Class' && option !== StartingEquipOptions.GOLD) {
              return (
                <CharacterEquipmentSelection
                  key={`${i}-equipment-group`}
                  groupIndex={i}
                  dataSource={g}
                  form={group}
                  fields='equipment.equipmentGroups'
                />
              )
            }
            if (dataSource?.__typename === 'Background') {
              return (
                <CharacterEquipmentSelection
                  key={`${i}-equipment-group`}
                  groupIndex={i}
                  dataSource={g}
                  form={group}
                  fields='equipment.equipmentGroups'
                />
              )
            }
          }
        })}
        <Grid.Col>
          <Button disabled={!isEquipmentSelectionComplete()} onClick={handleAddEquipment}>
            {`Add ${dataSource?.__typename === 'Class' ? option === StartingEquipOptions.GOLD && 'Equipment' : 'Gold'}`}
          </Button>
          {addedToCharacter && (
            <Button onClick={handleResetEquipment} className={sprinkles({ ms: 'space-4' })}>
              Reset Equipment
            </Button>
          )}
        </Grid.Col>
      </>
    )
  },
})

export default CharacterEquipmentOptions
