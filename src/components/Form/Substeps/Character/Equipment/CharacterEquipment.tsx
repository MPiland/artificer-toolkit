import { use, useEffect } from 'react'
import { FormContext } from '../../../FormContext'
import { Attributes, Currencies, StartingEquipOptions } from '@/enums'
import Button from '@/components/Button'
import { sprinkles } from '@/css/sprinkles.css'
import Grid from '@/components/Grid'
import CharacterEquipmentSelection from './CharacterEquipmentSelection'
import { ModalContext } from '@/components/Modal'
import { v4 as uuid } from 'uuid'
import { useEquipmentData } from '@/hooks'
import type { OnChange, Background, Character, Class, CharacterEquipment, CharacterEquipmentObject } from '@/types'
import type { FormStore } from '@/store'

const CharacterEquipment = ({ dataSource }: { dataSource: Class | Background }) => {
  const {
    formStore: { data, updateField, reinitState },
  } = use(FormContext) as {
    formStore: {
      data: Character
      updateField: OnChange<Character>['updateField']
      reinitState: FormStore<Character>['reinitState']
    }
  }

  const { showModal } = use(ModalContext)

  const { equipment } = useEquipmentData()

  const path = dataSource.__typename === 'Class' ? 'classEquipment' : 'backgroundEquipment'

  // Remove stale starting equipment if classes are removed
  useEffect(() => {
    if (
      dataSource.__typename === 'Class' &&
      data?.classEquipment?.option &&
      (!data?.classes || !data?.classes?.length)
    ) {
      updateField({
        path: 'classEquipment',
        value: {
          __typename: 'ClassStartingEquipment',
          equipmentGroups: null,
          goldOption: null,
          totalGold: null,
          option: null,
          addedToCharacter: false,
        },
      })
    }
    if (
      dataSource.__typename === 'Background' &&
      data?.backgroundEquipment?.equipmentGroups?.length &&
      !data?.background
    ) {
      updateField({
        path: 'backgroundEquipment',
        value: {
          __typename: 'BackgroundStartingEquipment',
          equipmentGroups: null,
          addedToCharacter: false,
        },
      })
    }
  }, [data?.classes, data?.classEquipment, data?.background, data?.backgroundEquipment, updateField, dataSource])

  // Check if all required equipment selections are complete or gold is ready
  const isEquipmentSelectionComplete = (): boolean => {
    // Check if a starting equipment option has been selected at all
    if (dataSource.__typename === 'Class' && (!data?.classEquipment?.option || data?.classEquipment?.addedToCharacter))
      return false

    // For gold option, check if totalGold has been generated
    if (dataSource.__typename === 'Class' && data?.classEquipment?.option === StartingEquipOptions.GOLD) {
      if (!data?.classEquipment?.totalGold && data?.classEquipment?.totalGold !== 0) return false
    }

    // For equipment option, check if all selections are complete
    if (
      (dataSource.__typename === 'Class' && data?.classEquipment?.option === StartingEquipOptions.EQUIPMENT) ||
      dataSource.__typename === 'Background'
    ) {
      // If no primaryClass or no equipment structure, return false
      if (!dataSource?.equipment) return false

      const equipmentGroups = data?.[path]?.equipmentGroups || []

      // For each equipment group in the class
      for (let groupIndex = 0; groupIndex < dataSource.equipment.length; groupIndex++) {
        const groupId = groupIndex.toString()

        // Find if this group has a selection
        const groupSelection = equipmentGroups.find((g) => g.groupId === groupId)

        // If no selection for this group, return false
        if (!groupSelection || groupSelection.optionId === undefined) {
          return false
        }

        // Get the selected option structure
        const optionIndex = Number(groupSelection.optionId)
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
    if (dataSource.__typename === 'Class' && data?.classEquipment?.option === StartingEquipOptions.GOLD) {
      const currencyGroupIndex = data?.currencyGroups?.findIndex((group) => group.container == null)
      const baglessIndex = currencyGroupIndex && currencyGroupIndex !== -1 ? currencyGroupIndex : 0

      const currencyIndex = data?.currencyGroups?.[baglessIndex]?.currencies?.findIndex(
        (currency) => currency?.id === Currencies.GOLD
      )
      const baglessCurrencyIndex = currencyIndex && currencyIndex !== -1 ? currencyIndex : 0
      updateField({
        path: `currencyGroups.${baglessIndex}.currencies.${baglessCurrencyIndex}.amount`,
        value: data?.classEquipment?.totalGold,
      })
      updateField({
        path: 'classEquipment.addedToCharacter',
        value: true,
      })
    }
    if (
      (dataSource.__typename === 'Class' && data?.classEquipment?.option === StartingEquipOptions.EQUIPMENT) ||
      dataSource.__typename === 'Background'
    ) {
      const equipmentArray = [] as Omit<NonNullable<CharacterEquipment['inventory']>, '__typename'>
      data?.[path]?.equipmentGroups?.forEach((group) => {
        if (group?.equipment?.length) {
          group?.equipment?.forEach((gE) => {
            const fullEquipment = equipment.findEquipment(gE.id)
            if (fullEquipment) {
              const equipObj: CharacterEquipmentObject = {
                id: uuid(),
                __typename: 'CharacterEquipmentObject',
                equipmentId: gE.id,
                quantity: gE.quantity,
              }
              equipmentArray?.push(equipObj)
            }
          })
        }
      })
      updateField({
        path: 'equipment.inventory',
        value: equipmentArray,
      })
      updateField({
        path: `${path}.addedToCharacter`,
        value: true,
      })
    }
  }

  const resetEquipment = () => {
    const formDataCopy = {
      ...data,
      equipment: {
        __typename: 'CharacterEquipment',
        ...data.equipment,
        inventory: [] as CharacterEquipmentObject[],
      } as CharacterEquipment,
      currencyGroups: [],
    }
    formDataCopy.equipment.inventory = []
    formDataCopy.currencyGroups = []
    if (dataSource.__typename === 'Class') {
      formDataCopy.classEquipment = {
        __typename: 'ClassStartingEquipment',
        ...formDataCopy.classEquipment,
        equipmentGroups: [],
        addedToCharacter: false,
        option: '',
        totalGold: 0,
      }
    } else {
      formDataCopy.backgroundEquipment = {
        __typename: 'BackgroundStartingEquipment',
        ...formDataCopy.backgroundEquipment,
        equipmentGroups: [],
        addedToCharacter: false,
      }
    }
    reinitState(formDataCopy)
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
      {((dataSource.__typename === 'Class' && data.classEquipment?.option !== StartingEquipOptions.GOLD) ||
        dataSource.__typename === 'Background') &&
        dataSource?.equipment?.map((group, groupIndex) => {
          if (group?.length) {
            return (
              <CharacterEquipmentSelection
                groupIndex={groupIndex}
                group={group}
                dataSource={dataSource}
                key={`equipment-group-${groupIndex}`}
              />
            )
          }
        })}
      <Grid.Item justify='center'>
        <Button disabled={!isEquipmentSelectionComplete()} onClick={handleAddEquipment}>
          {`Add ${
            dataSource.__typename === 'Class' ?
              data.classEquipment?.option === StartingEquipOptions.GOLD && 'Equipment'
            : 'Gold'
          }`}
        </Button>
        {data?.[path]?.addedToCharacter && (
          <Button onClick={handleResetEquipment} className={sprinkles({ ms: 'space-4' })}>
            Reset Equipment
          </Button>
        )}
      </Grid.Item>
    </>
  )
}

export default CharacterEquipment
