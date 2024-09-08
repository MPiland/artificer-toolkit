import { useEffect, useMemo } from 'react'
import { useForm } from '../../../hooks/UseForm'
import Collapse from '../../Collapse/Collapse'
import Table from '../../Table/Table'
import { RowHeaderType, RowInputType } from '../../../utils/types'

const LevelAttributes = () => {
  const { formState, setFormState, context } = useForm()

  // Add level attribute table
  useEffect(() => {
    if (
      !formState.levelAttribute &&
      context.title === 'classes' &&
      (formState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellCaster') ||
        (formState.attribute?.some((attributeItem: any) => attributeItem.name === 'resource') &&
          formState.resource?.method?.name === 'setPerLevel'))
    ) {
      setFormState({
        type: 'added',
        target: { name: 'levelAttribute' },
      })
    } else if (
      formState.levelAttribute &&
      (context.title !== 'classes' ||
        (!formState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellCaster') &&
          (!formState.attribute?.some((attributeItem: any) => attributeItem.name === 'resource') ||
            formState.resource?.method?.name !== 'setPerLevel')))
    ) {
      setFormState({
        type: 'removed',
        target: { name: 'levelAttribute' },
      })
    }
  }, [
    formState.levelAttribute,
    setFormState,
    context.title,
    formState.category?.name,
    formState.attribute,
    formState.resource?.method?.name,
  ])

  // Class level table data
  const levelTableColumns = useMemo(() => {
    const spellCaster = formState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellCaster')

    const resource =
      formState.attribute?.some((attributeItem: any) => attributeItem.name === 'resource') &&
      formState?.resource?.method?.name === 'setPerLevel'
    const inputArray: RowInputType[] = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
        required: true,
      },
    ]

    if (resource) {
      inputArray.push({
        name: 'resourcePoints',
        value: `${formState.resource?.value ?? 'Resource'} Points`,
        validation: 'num',
        errorMsg: 'Must contain only numbers',
      })
    }

    if (spellCaster) {
      inputArray.push({
        name: 'cantripsKnown',
        value: 'Cantrips Known',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
      if (formState.spellcasting?.attribute?.some((attributeItem: any) => attributeItem.name === 'limitKnownSpells')) {
        inputArray.push({
          name: 'spellsKnown',
          value: 'Spells Known',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        })
      }
      if (formState.spellcasting?.maxSpellLevel) {
        for (let i = 0; i < formState.spellcasting?.maxSpellLevel; i++) {
          inputArray.push({
            name: `spellSlots.${i}.slotCount`,
            value: `${i + 1}`,
            errorMsg: 'Must contain only numbers',
            validation: 'num',
          })
        }
      }
    }

    const headerArray: RowHeaderType[] = inputArray.map((inputItem) => ({
      value: inputItem.value,
      required: true,
    }))

    return { inputs: inputArray, headers: headerArray }
  }, [formState.attribute, formState?.resource, formState?.spellcasting])

  return (
    (formState.attribute?.some((attributeItem: any) => attributeItem.name === 'spellCaster') ||
      (formState.attribute?.some((attributeItem: any) => attributeItem.name === 'resource') &&
        formState.resource?.method?.name === 'setPerLevel')) &&
    context.title === 'classes' && (
      <>
        <Collapse>
          <Collapse.Header title={'Level Attributes'} startOpened={context.type === 'new'} />
          <Collapse.Body>
            <Table
              name='levelAttribute'
              rows={{
                inputs: levelTableColumns.inputs,
                headers: levelTableColumns.headers,
              }}
              value={formState?.levelAttribute}
              onChange={setFormState}
              addRow={true}
              scrollable='horizontal'
              border={false}
            />
          </Collapse.Body>
        </Collapse>
      </>
    )
  )
}

export default LevelAttributes
