import { Background, Character, Class, Contains } from '../../../../../../amplify/gql/types'
import { UpdateState } from '../../../../../types/form'
import { use, useEffect } from 'react'
import { FormContext } from '../../../FormContext'
import { Attributes, Currencies, StartingEquipmentOption } from '../../../../../types/enums'
import Button from '../../../../Button/Button'
import { sprinkles } from '../../../../../css/sprinkles.css'
import Grid from '../../../../Grid/Grid'
import CharacterEquipmentSelection from '../../../Subforms/Character/CharacterEquipment/CharacterEquipmentSelection'
import { useListEquipmentQuery } from '../../../../../features/equipment/equipmentApi'
import { useLocation, useNavigate } from 'react-router-dom'

const CharacterEquipment = ({ dataSource }: { dataSource: Class | Background }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { data: equipment } = useListEquipmentQuery()

  const path = dataSource.__typename === 'Class' ? 'classEquipment' : 'backgroundEquipment'

  // Remove stale starting equipment if classes are removed
  useEffect(() => {
    if (
      dataSource.__typename === 'Class' &&
      formData?.classEquipment?.option &&
      (!formData?.classes || !(formData?.classes?.length > 0))
    ) {
      updateFormData({
        type: 'update',
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
      formData?.backgroundEquipment?.equipmentGroups?.length > 0 &&
      !formData?.background
    ) {
      updateFormData({
        type: 'update',
        path: 'backgroundEquipment',
        value: {
          __typename: 'BackgroundStartingEquipment',
          equipmentGroups: null,
          addedToCharacter: false,
        },
      })
    }
  }, [
    formData?.classes,
    formData?.classEquipment,
    formData?.background,
    formData?.backgroundEquipment,
    updateFormData,
    dataSource,
  ])

  // Check if all required equipment selections are complete or gold is ready
  const isEquipmentSelectionComplete = (): boolean => {
    // Check if a starting equipment option has been selected at all
    if (
      dataSource.__typename === 'Class' &&
      (!formData?.classEquipment?.option || formData?.classEquipment?.addedToCharacter)
    )
      return false

    // For gold option, check if totalGold has been generated
    if (dataSource.__typename === 'Class' && formData.classEquipment.option === StartingEquipmentOption.gold) {
      return !!formData.classEquipment.totalGold && formData.classEquipment.totalGold > 0
    }

    // For equipment option, check if all selections are complete
    if (
      (dataSource.__typename === 'Class' && formData.classEquipment.option === StartingEquipmentOption.equipment) ||
      dataSource.__typename === 'Background'
    ) {
      // If no primaryClass or no equipment structure, return false
      if (!dataSource?.equipment) return false

      const equipmentGroups = formData?.[path]?.equipmentGroups || []

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
        const selectedOptionStructure = dataSource?.equipment?.[groupIndex][optionIndex]

        if (!selectedOptionStructure) return false

        // Check each item in the selected option structure that requires choices
        for (let itemIndex = 0; itemIndex < selectedOptionStructure.length; itemIndex++) {
          const item = selectedOptionStructure[itemIndex]

          // Skip items that don't provide options
          if (!item.attributes?.includes(Attributes.providesOptions)) {
            continue
          }

          const selectionCount = Number(item.selectionCount) || 1

          // Check if all required selections for this item exist
          for (let selIndex = 0; selIndex < selectionCount; selIndex++) {
            const selectionId = `${itemIndex}-${selIndex}`

            // Look for this specific selection in the group's equipment
            const hasSelection = groupSelection.equipment.some((e) => e.selectionId === selectionId && !!e.id)

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
    if (dataSource.__typename === 'Class' && formData?.classEquipment?.option === StartingEquipmentOption.gold) {
      const currencyGroupIndex = formData?.currencyGroups?.findIndex((group) => group.container == null)
      const baglessIndex = currencyGroupIndex !== -1 ? currencyGroupIndex : 0

      const currencyIndex = formData?.currencyGroups?.[baglessIndex]?.currencies?.findIndex(
        (currency) => currency?.id === Currencies.gold
      )
      const baglessCurrencyIndex = currencyIndex !== -1 ? currencyIndex : 0
      updateFormData({
        type: 'update',
        path: `currencyGroups.${baglessIndex}.currencies.${baglessCurrencyIndex}.amount`,
        value: formData?.classEquipment?.totalGold,
      })
      updateFormData({
        type: 'update',
        path: 'classEquipment.addedToCharacter',
        value: true,
      })
    }
    if (
      (dataSource.__typename === 'Class' && formData?.classEquipment?.option === StartingEquipmentOption.equipment) ||
      dataSource.__typename === 'Background'
    ) {
      const equipmentArray: Character['equipment'] = []
      formData?.[path]?.equipmentGroups?.forEach((group) => {
        if (group?.equipment?.length > 0) {
          group?.equipment?.forEach((gE) => {
            const fullEquipment = equipment.find((e) => e.id === gE.id)
            if (fullEquipment) {
              const equipObj: Contains = { __typename: 'Contains', id: gE.id, quantity: gE.quantity }

              if (fullEquipment?.contains?.length > 0) {
                equipObj.contains = fullEquipment.contains
              }

              equipmentArray?.push(equipObj)
            }
          })
        }
      })
      updateFormData({
        type: 'update',
        path: 'equipment',
        value: equipmentArray,
      })
      updateFormData({
        type: 'update',
        path: `${path}.addedToCharacter`,
        value: true,
      })
    }
  }

  const handleResetEquipment = () => {
    navigate(`alert/reset`, {
      state: {
        message:
          'WARNING: Resetting equipment will remove all current equipment and currency from your character. Are you sure you want to continue?',
        previous: location,
        dataSource: dataSource.__typename === 'Class' ? 'classEquipment' : 'backgroundEquipment',
      },
    })
  }

  return (
    <>
      {((dataSource.__typename === 'Class' && formData.classEquipment?.option !== StartingEquipmentOption.gold) ||
        dataSource.__typename === 'Background') &&
        dataSource.equipment.map((group, groupIndex) => (
          <CharacterEquipmentSelection
            groupIndex={groupIndex}
            group={group}
            dataSource={dataSource}
            key={`equipment-group-${groupIndex}`}
          />
        ))}
      <Grid.Item justify='center'>
        <Button disabled={!isEquipmentSelectionComplete()} onClick={handleAddEquipment}>
          {`Add ${
            dataSource.__typename === 'Class'
              ? formData.classEquipment?.option === StartingEquipmentOption.gold && 'Equipment'
              : 'Gold'
          }`}
        </Button>
        {formData?.[path]?.addedToCharacter && (
          <Button onClick={handleResetEquipment} className={sprinkles({ ms: 'space-4' })}>
            Reset Equipment
          </Button>
        )}
      </Grid.Item>
    </>
  )
}

export default CharacterEquipment
