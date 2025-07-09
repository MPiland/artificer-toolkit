import { Grid } from '@mantine/core'
import { Fragment, useCallback, useEffect } from 'react'
import { Attributes } from '@/enums'
import { useSystemData, useEquipmentData, useFieldUpdates } from '@/hooks'
import type { EquipmentOptionItem, StartingEquipmentGroupInput, StartingEquipmentInput } from '@/types'
import { withFieldGroup, starting_equipment_group_option } from '@/components/Form'
import { StartingEquipmentGroupInputSchema, StartingEquipmentInputSchema } from '@/schemas'
import { useFormStore } from '@/store'
import { useStore } from '@tanstack/react-form'

type CharacterEquipmentSelectionProps = {
  groupIndex: number
  dataSource?: EquipmentOptionItem[][]
  formKind?: 'Class' | 'Background'
}

const CharacterEquipmentSelection = withFieldGroup({
  defaultValues: [] as StartingEquipmentGroupInput[],
  props: {
    groupIndex: 0,
    equipmentGroups: undefined,
    dataSource: undefined,
    formKind: 'Class',
  } as CharacterEquipmentSelectionProps,
  render: function Render({ group, dataSource, groupIndex, formKind }) {
    const { AppField } = group

    const formStore = useFormStore()

    const { system } = useSystemData()
    const { equipment } = useEquipmentData()

    const path = formKind === 'Class' ? 'classEquipment' : 'backgroundEquipment'

    const { fieldListeners } = useFieldUpdates({ data: 'form', path: `${path}.equipmentGroups` })

    const { equipmentGroups } = useStore(group.store, (state) => ({ equipmentGroups: state.values }))

    const hasOnlyOneOption = dataSource?.length === 1
    const isAlreadySelected = equipmentGroups?.some((g) => g.groupId === groupIndex?.toString())

    // Generate a descriptive label for an option in the dropdown
    const generateOptionLabel = useCallback(
      (option: EquipmentOptionItem[], optIndex: number) => {
        // Start with the option letter (A, B, C, etc.)
        const label = dataSource?.length && dataSource?.length > 1 ? `(${String.fromCharCode(65 + optIndex)}) ` : ' '

        // Add descriptions of each item in the option
        const itemDescriptions = option.map((item) => {
          if (item.attributes?.includes(Attributes.PROVIDES_OPTIONS)) {
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
      [equipment, dataSource?.length, system.equipment.categories, system.equipment.properties]
    )

    // Generate equipment items from the selected option
    const generateEquipmentItems = (selectedOption: EquipmentOptionItem): StartingEquipmentInput[] => {
      const items: StartingEquipmentInput[] = []

      if (selectedOption.equipment && Array.isArray(selectedOption.equipment)) {
        // Direct equipment references
        selectedOption.equipment.forEach((equipId) => {
          if (equipId !== 'all') {
            items.push(
              StartingEquipmentInputSchema.parse({
                id: equipId,
                quantity: selectedOption.quantity || 1,
              })
            )
          }
        })
      }

      return items
    }

    // Get the currently selected option index for a group
    const getEquipmentGroupOptionId = (groupIndex: number) => {
      const groupData = equipmentGroups?.find((g) => g.groupId === groupIndex.toString())

      // If no group data found, return null
      if (!groupData) return null

      // If optionId is undefined or null, return null
      if (groupData.optionId === undefined || groupData.optionId === null) {
        return null
      }

      // Return the option index as a number
      return groupData.optionId
    }

    const groupOptionId = getEquipmentGroupOptionId(groupIndex || 0) || null

    // Render dropdowns for equipment that provides options
    const renderOptionsSelection = (
      groupIndex: number,
      optionIndex: number,
      itemIndex: number,
      item: EquipmentOptionItem
    ) => {
      const selectionCount = Number(item.selectionCount) || 1
      const filteredEquipment = equipment.filterByCategory(item.category).filterByProperties(item.properties)

      // Find current selections for this item
      const currentGroups = equipmentGroups || []
      const currentGroup = currentGroups.find(
        (g) => g.groupId === groupIndex.toString() && g.optionId === optionIndex.toString()
      )

      return (
        <Fragment key={`${groupIndex}-${itemIndex}-option-selection`}>
          {Array.from({ length: selectionCount }).map((_, selIndex) => {
            const currentSelection = currentGroup?.equipment?.find((e) => e.selectionId === `${itemIndex}-${selIndex}`)

            const selectedEquipId = currentSelection?.id || ''

            return (
              <AppField
                name={`[${groupIndex}].equipment[${itemIndex}]`}
                listeners={{
                  ...fieldListeners,
                  onChange: ({ value }) => {
                    if (value != null) {
                      // Define optionKey for rest of function
                      const optionKey = `${itemIndex}-${selIndex}`

                      // The ID of the equipment piece that was either selected or automatically added
                      const equipmentId = value.toString()
                      const currentGroups = [...(equipmentGroups || [])]

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
                        updatedGroup.equipment[existingItemIndex] = StartingEquipmentInputSchema.parse({
                          id: equipmentId,
                          selectionId: optionKey,
                          quantity: 1,
                        })
                      } else {
                        // Add new selection
                        updatedGroup.equipment.push(
                          StartingEquipmentInputSchema.parse({
                            id: equipmentId,
                            selectionId: optionKey,
                            quantity: 1,
                          })
                        )
                      }

                      // Replace the group in our array with the updated version
                      currentGroups[groupArrayIndex] = updatedGroup

                      // Update the form data
                      return formStore.updateField({
                        path: `${path}.equipmentGroups`,
                        value: currentGroups,
                      })
                    } else {
                      // Define optionKey for rest of function
                      const optionKey = `${itemIndex}-${selIndex}-equipment-selection`

                      // Handle removal of a specific option
                      const currentGroups = [...(equipmentGroups || [])]
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

                        return formStore.updateField({
                          path: `${path}.equipmentGroups`,
                          value: currentGroups,
                        })
                      }
                    }
                  },
                }}
              >
                {({ DropdownField }) => (
                  <Grid.Col key={`${groupIndex}-${itemIndex}-${selIndex}-equipment-option`}>
                    <DropdownField
                      options={filteredEquipment?.map((equip) => ({
                        id: equip.id,
                        value: equip.id,
                        label: equip.label,
                      }))}
                      exist={selectedEquipId}
                    />
                  </Grid.Col>
                )}
              </AppField>
            )
          })}
        </Fragment>
      )
    }

    // Render the selected equipment for a group
    const renderSelectedEquipment = (group: EquipmentOptionItem[][], groupIndex: number) => {
      const optionId = getEquipmentGroupOptionId(groupIndex)

      if (!optionId && optionId !== '0') return null

      const selectedOption = group[Number(optionId)]

      if (!selectedOption) return null

      return selectedOption.map((item, itemIndex) => {
        // Check if this item provides options
        const providesOptions = item.attributes?.includes(Attributes.PROVIDES_OPTIONS)

        if (providesOptions) {
          // Render Options dropdown if selection is possible
          return renderOptionsSelection(groupIndex, Number(optionId), itemIndex, item)
        }
      })
    }

    useEffect(() => {
      if (hasOnlyOneOption && !isAlreadySelected) {
        formStore.updateField({
          path: `${path}.equipmentGroups[${groupIndex}]`,
          value: '0', // Select the first option
        })
      }
    }, [groupIndex, hasOnlyOneOption, isAlreadySelected, path, formStore])

    const renderEquipmentGroup = useCallback(() => {
      if (dataSource?.length) {
        if (hasOnlyOneOption && dataSource?.[0]?.length) {
          return generateOptionLabel(dataSource?.[0], 0)
        }

        return (
          <AppField
            name={`[${groupIndex}]`}
            listeners={{
              ...fieldListeners,
              onChange: ({ value }) => {
                if (value != null) {
                  // Option ID for which option within the group that was picked
                  const optionIndex = value.toString()
                  const currentGroups = [...(equipmentGroups || [])]

                  // Find if this group already exists
                  const existingGroupIndex = currentGroups.findIndex((g) => g.groupId === groupIndex.toString())

                  // Get the selected equipment items from the class data
                  const selectedOption = dataSource?.[groupIndex]?.[Number(optionIndex)] || []
                  const equipmentItems = generateEquipmentItems(selectedOption)

                  if (existingGroupIndex >= 0) {
                    // Update existing group
                    currentGroups[existingGroupIndex] = StartingEquipmentGroupInputSchema.parse({
                      ...currentGroups[existingGroupIndex],
                      optionId: optionIndex,
                      equipment: equipmentItems,
                    })
                  } else {
                    // Add new group
                    currentGroups.push(
                      StartingEquipmentGroupInputSchema.parse({
                        optionId: optionIndex,
                        groupId: groupIndex.toString(),
                        equipment: equipmentItems,
                      })
                    )
                  }

                  // Update the form data
                  formStore.updateField({
                    path: `${path}.equipmentGroups`,
                    value: currentGroups,
                  })
                  return value
                } else {
                  // Handle removal of the entire group
                  if (equipmentGroups) {
                    const updatedGroups = equipmentGroups.filter((g) => g.groupId !== groupIndex?.toString())

                    formStore.updateField({
                      path: `${path}.equipmentGroups`,
                      value: updatedGroups.length ? updatedGroups : null,
                    })

                    return undefined
                  }
                }
              },
            }}
          >
            {({ DropdownField }) => (
              <DropdownField
                exist={groupOptionId || undefined}
                label={`Select Option`}
                options={dataSource
                  ?.filter((option) => !!option)
                  .map((option, optIndex) => ({
                    id: optIndex.toString(),
                    value: optIndex.toString(),
                    label: generateOptionLabel(option, optIndex),
                  }))}
              />
            )}
          </AppField>
        )
      }
    }, [
      generateOptionLabel,
      groupIndex,
      groupOptionId,
      path,
      hasOnlyOneOption,
      dataSource,
      AppField,
      equipmentGroups,
      formStore,
      fieldListeners,
    ])

    return (
      <Grid.Col>
        <Grid className={starting_equipment_group_option}>
          <Grid.Col>
            <h4>Equipment Group {groupIndex + 1}</h4>
          </Grid.Col>
          <Grid.Col>{renderEquipmentGroup()}</Grid.Col>
          {dataSource?.length && renderSelectedEquipment(dataSource, groupIndex)}
        </Grid>
      </Grid.Col>
    )
  },
})
export default CharacterEquipmentSelection
