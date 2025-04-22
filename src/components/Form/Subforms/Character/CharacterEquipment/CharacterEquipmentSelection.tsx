import Dropdown from '../../../../Dropdown/Dropdown'
import Grid from '../../../../Grid/Grid'
import type {
  Background,
  BackgroundEquipment,
  Character,
  Class,
  ClassEquipment,
  StartingEquipment,
} from '../../../../../../amplify/gql/types'
import { starting_equipment_group_option } from '../../../Character.css'
import { Fragment, use, useCallback, useEffect } from 'react'
import { FormContext } from '../../../FormContext'
import { Attributes } from '../../../../../types/enums'
import useSystemData from '../../../../../hooks/useSystemData'
import useEquipmentData from '../../../../../hooks/useEquipmentData'
import type { OnChange } from '../../../../../types/form'

const CharacterEquipmentSelection = ({
  groupIndex,
  group,
  dataSource,
}: {
  groupIndex: number
  group: (ClassEquipment | BackgroundEquipment)[][]
  dataSource: Class | Background
}) => {
  const {
    formStore: { data, updateField },
  } = use(FormContext) as {
    formStore: {
      data: Character
      updateField: OnChange<Character>['updateField']
    }
  }

  const { system } = useSystemData()
  const { equipment } = useEquipmentData()

  const path = dataSource.__typename === 'Class' ? 'classEquipment' : 'backgroundEquipment'

  const hasOnlyOneOption = group.length === 1
  const isAlreadySelected = data?.[path]?.equipmentGroups?.some((g) => g.groupId === groupIndex.toString())

  // Generate a descriptive label for an option in the dropdown
  // Generate a descriptive label for an option in the dropdown
  const generateOptionLabel = useCallback(
    (option: (ClassEquipment | BackgroundEquipment)[], optIndex: number) => {
      // Start with the option letter (A, B, C, etc.)
      const label = group?.length > 1 ? `(${String.fromCharCode(65 + optIndex)}) ` : ' '

      // Add descriptions of each item in the option
      const itemDescriptions = option.map((item) => {
        if (item.attributes?.includes(Attributes.providesOptions)) {
          // This item provides choices
          let description = `Select ${item.selectionCount}x `

          // Add property descriptions if available
          if (item?.properties?.length) {
            const propertyLabels = item?.properties
              .map((propId) => {
                const property = system.equipment.properties.find((p) => p?.id === propId)
                return property?.label || ''
              })
              .filter(Boolean)
              .join(', ')

            description += `${propertyLabels} `
          }

          // Add category
          const category = system.equipment.categories.find((c) => c.id === item?.category)
          description += category?.label || 'item'

          return description
        } else if (item.equipment && Array.isArray(item.equipment)) {
          // Direct equipment references
          return item.equipment
            .map((equipId) => {
              if (equipId === 'all') return 'any item'

              const equipItem = equipment.find((e) => e?.id === equipId)
              return equipItem ? `${item?.quantity || 1}x ${equipItem?.label}` : 'unknown item'
            })
            .join(' and ')
        }

        return 'unknown item'
      })

      // Join with proper punctuation based on number of items
      if (itemDescriptions.length <= 1) {
        return label + itemDescriptions.join('')
      } else if (itemDescriptions.length === 2) {
        return label + itemDescriptions.join(' and ')
      } else {
        // For more than 2 items, use commas and 'and' for the last item
        const lastItem = itemDescriptions.pop()
        return label + itemDescriptions.join(', ') + ', and ' + lastItem
      }
    },
    [equipment, group?.length, system.equipment.categories, system.equipment.properties]
  )

  // Generate equipment items from the selected option
  const generateEquipmentItems = (selectedOption: (ClassEquipment | BackgroundEquipment)[]): StartingEquipment[] => {
    const items: StartingEquipment[] = []

    selectedOption.forEach((item) => {
      if (item.equipment && Array.isArray(item.equipment)) {
        // Direct equipment references
        item.equipment.forEach((equipId) => {
          if (equipId !== 'all') {
            items.push({
              __typename: 'StartingEquipment',
              id: equipId,
              quantity: item.quantity || 1,
            })
          }
        })
      }
    })

    return items
  }

  // Get the currently selected option index for a group
  const getEquipmentGroupOptionIndex = (groupIndex: number) => {
    const equipmentGroups = data?.[path]?.equipmentGroups || []
    const groupData = equipmentGroups.find((g) => g.groupId === groupIndex.toString())

    // If no group data found, return null
    if (!groupData) return null

    // If optionId is undefined or null, return null
    if (groupData.optionId === undefined || groupData.optionId === null) {
      return null
    }

    // Return the option index as a number
    return groupData.optionId
  }

  const groupOptionIndex = getEquipmentGroupOptionIndex(groupIndex) || null

  // Render dropdowns for equipment that provides options
  const renderOptionsSelection = (
    groupIndex: number,
    optionIndex: number,
    itemIndex: number,
    item: ClassEquipment | BackgroundEquipment
  ) => {
    const selectionCount = Number(item.selectionCount) || 1
    const filteredEquipment = equipment.filterByCategory(item.category).filterByProperties(item.properties)

    // Find current selections for this item
    const currentGroups = data?.[path]?.equipmentGroups || []
    const currentGroup = currentGroups.find(
      (g) => g.groupId === groupIndex.toString() && g.optionId === optionIndex.toString()
    )

    return (
      <Fragment key={`option-selection-${groupIndex}-${itemIndex}`}>
        {Array.from({ length: selectionCount }).map((_, selIndex) => {
          const currentSelection = currentGroup?.equipment?.find((e) => e.selectionId === `${itemIndex}-${selIndex}`)

          const selectedEquipId = currentSelection?.id

          return (
            <Grid.Item key={`equipment-option-${groupIndex}-${itemIndex}-${selIndex}`}>
              <Dropdown<Character>
                name={`${path}.equipmentGroups.${groupIndex}.equipment.${itemIndex}`}
                value={selectedEquipId || ''}
                onChange={{
                  updateField: ({ value }) => {
                    // Define optionKey for rest of function
                    const optionKey = `${itemIndex}-${selIndex}`

                    // The ID of the equipment piece that was either selected or automatically added
                    const equipmentId = value.toString()
                    const currentGroups = [...(data?.[path]?.equipmentGroups || [])]

                    // Find the current group
                    const groupArrayIndex = currentGroups.findIndex(
                      (g) => g.groupId === groupIndex.toString() && g.optionId === optionIndex.toString()
                    )

                    if (groupArrayIndex === -1) return

                    // Create a deep copy of the group we're modifying
                    const updatedGroup = {
                      ...currentGroups[groupArrayIndex],
                      equipment: [...(currentGroups?.[groupArrayIndex]?.equipment || [])], // Create a new array for equipment
                    }

                    // Find if we already have this selection
                    const existingItemIndex = updatedGroup.equipment.findIndex((e) => e.selectionId === optionKey)

                    if (existingItemIndex >= 0) {
                      // Update existing selection
                      updatedGroup.equipment[existingItemIndex] = {
                        __typename: 'StartingEquipment',
                        id: equipmentId,
                        selectionId: optionKey,
                        quantity: 1,
                      }
                    } else {
                      // Add new selection
                      updatedGroup.equipment.push({
                        __typename: 'StartingEquipment',
                        id: equipmentId,
                        selectionId: optionKey,
                        quantity: 1,
                      })
                    }

                    // Replace the group in our array with the updated version
                    currentGroups[groupArrayIndex] = updatedGroup

                    // Update the form data
                    return {
                      path: `${path}.equipmentGroups`,
                      value: currentGroups,
                    }
                  },
                  removeField: () => {
                    // Define optionKey for rest of function
                    const optionKey = `${itemIndex}-${selIndex}`

                    // Handle removal of a specific option
                    const currentGroups = [...(data?.[path]?.equipmentGroups || [])]
                    const groupArrayIndex = currentGroups.findIndex(
                      (g) => g.groupId === groupIndex.toString() && g.optionId === optionIndex.toString()
                    )

                    if (groupArrayIndex !== -1) {
                      const updatedGroup = {
                        ...currentGroups[groupArrayIndex],
                        // Filter out the item we want to remove
                        equipment: currentGroups?.[groupArrayIndex]?.equipment?.filter(
                          (e) => e.selectionId !== optionKey
                        ),
                      }

                      // Replace the group in our array
                      currentGroups[groupArrayIndex] = updatedGroup

                      return updateField({
                        path: `${path}.equipmentGroups`,
                        value: currentGroups,
                      })
                    }
                  },
                }}
                options={filteredEquipment?.map((equip) => ({
                  id: equip.id,
                  value: equip.id,
                  label: equip.label,
                }))}
              />
            </Grid.Item>
          )
        })}
      </Fragment>
    )
  }

  // Render the selected equipment for a group
  const renderSelectedEquipment = (group: (ClassEquipment | BackgroundEquipment)[][], groupIndex: number) => {
    const optionIndex = getEquipmentGroupOptionIndex(groupIndex)

    if (!optionIndex && optionIndex !== '0') return null

    const selectedOption = group[Number(optionIndex)]

    if (!selectedOption) return null

    return selectedOption.map((item, itemIndex) => {
      // Check if this item provides options
      const providesOptions = item.attributes?.includes(Attributes.providesOptions)

      if (providesOptions) {
        // Render Options dropdown if selection is possible
        return renderOptionsSelection(groupIndex, Number(optionIndex), itemIndex, item)
      }
    })
  }

  useEffect(() => {
    if (hasOnlyOneOption && !isAlreadySelected) {
      updateField({
        path: `${path}.equipmentGroups.${groupIndex}`,
        value: '0', // Select the first option
      })
    }
  }, [groupIndex, hasOnlyOneOption, isAlreadySelected, path, group, updateField])

  const renderEquipmentGroup = useCallback(() => {
    if (group.length) {
      if (hasOnlyOneOption && group[0]?.length) {
        return generateOptionLabel(group[0], 0)
      }

      return (
        <Dropdown<Character>
          name={`${path}.equipmentGroups.${groupIndex}`}
          value={groupOptionIndex}
          label={`Select Option`}
          onChange={{
            updateField: ({ value }) => {
              // Option ID for which option within the group that was picked
              const optionIndex = value.toString()
              const currentGroups = [...(data?.[path]?.equipmentGroups || [])]

              // Find if this group already exists
              const existingGroupIndex = currentGroups.findIndex((g) => g.groupId === groupIndex.toString())

              // Get the selected equipment items from the class data
              const selectedOption = dataSource?.equipment?.[groupIndex]?.[Number(optionIndex)] || []
              const equipmentItems = generateEquipmentItems(selectedOption)

              if (existingGroupIndex >= 0) {
                // Update existing group
                currentGroups[existingGroupIndex] = {
                  ...currentGroups[existingGroupIndex],
                  optionId: optionIndex,
                  equipment: equipmentItems,
                }
              } else {
                // Add new group
                currentGroups.push({
                  __typename: 'StartingEquipmentGroup',
                  optionId: optionIndex,
                  groupId: groupIndex.toString(),
                  equipment: equipmentItems,
                })
              }

              // Update the form data
              return {
                path: `${path}.equipmentGroups`,
                value: currentGroups,
              }
            },
            removeField: () => {
              // Handle removal of the entire group
              if (data?.[path]?.equipmentGroups) {
                const updatedGroups = data[path].equipmentGroups.filter((g) => g.groupId !== groupIndex.toString())

                return updateField({
                  path: `${path}.equipmentGroups`,
                  value: updatedGroups.length ? updatedGroups : null,
                })
              }
            },
          }}
          options={group
            .filter((option) => !!option)
            .map((option, optIndex) => ({
              id: optIndex.toString(),
              value: optIndex.toString(),
              label: generateOptionLabel(option, optIndex),
            }))}
        />
      )
    }
  }, [
    generateOptionLabel,
    group,
    groupIndex,
    groupOptionIndex,
    path,
    hasOnlyOneOption,
    data,
    dataSource?.equipment,
    updateField,
  ])

  return (
    <Grid.Item justify='center'>
      <Grid className={starting_equipment_group_option}>
        <Grid.Item>
          <h4>Equipment Group {groupIndex + 1}</h4>
        </Grid.Item>
        <Grid.Item>{renderEquipmentGroup()}</Grid.Item>
        {group?.length && renderSelectedEquipment(group, groupIndex)}
      </Grid>
    </Grid.Item>
  )
}
export default CharacterEquipmentSelection
