import '../../scss/card.scss'
import parse from 'html-react-parser'
import { get, truncate } from 'lodash'
import { forwardRef } from 'react'

const Spell = forwardRef(({ state: spell }, ref) => {
  const materialDesc = () => {
    if (spell.materialDesc) {
      return '*' + spell.materialDesc
    } else return ''
  }

  const getValueFromState = (inputItem, stateItem, truncateNum) => {
    const processItem = (item, state, shouldTruncate) => {
      if (Array.isArray(item)) {
        const nestedValues = item.map((nestedItem) =>
          processItem(nestedItem, state, shouldTruncate)
        )
        return nestedValues.join(' ')
      } else {
        const value = get(state, item)
        let formattedValue
        if (Array.isArray(value)) {
          if (value.length > 0) {
            formattedValue = value
              .map((nestedValue) =>
                shouldTruncate
                  ? truncate(nestedValue.value, {
                      length: truncateNum,
                      omission: '',
                    })
                  : nestedValue.value
              )
              .join(' / ')
            return formattedValue
          }
        } else {
          formattedValue = shouldTruncate
            ? truncate(value, { length: truncateNum })
            : value
        }
        return formattedValue
      }
    }

    if (inputItem) {
      if (Array.isArray(inputItem[0])) {
        const nameItems = inputItem.map((nameItem) =>
          processItem(nameItem, stateItem, truncateNum !== undefined)
        )
        return nameItems.join(' / ')
      } else {
        const value = processItem(
          inputItem,
          stateItem,
          truncateNum !== undefined
        )
        return value !== undefined ? value : '---'
      }
    }

    return '---'
  }

  const cols = [
    { header: 'LEVEL', field: 'level' },
    {
      header: 'CASTING TIME',
      field: ['action.value', 'action.actionType.value'],
    },
    {
      header: 'RANGE/AREA',
      field: [
        ['range.rangeType.value', 'range.distance'],
        ['shape.shapeType.value', 'shape.size'],
      ],
    },
    { header: 'REQUIREMENTS', field: 'requirement', truncate: 1 },
    {
      header: 'DURATION',
      field: ['duration.value', 'duration.durationType.value'],
    },
    { header: 'SCHOOL', field: 'school.value' },
    {
      header: 'SAVE ABILITY',
      field: 'saveAbility.value',
      filter: ['isAttack', 'requireSave'],
    },
    { header: 'DAMAGE', field: 'damage.damageType' },
  ]

  const content = (
    <>
      <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 gy-3'>
        {cols.map((colItem, colIndex) => {
          return (
            <div className='col' key={colIndex}>
              <div className='row fw-bold'>
                <div className='col'>{colItem.header}</div>
              </div>
              <div className='row'>
                <div className='col'>
                  {getValueFromState(
                    colItem.field,
                    spell,
                    colItem.truncate,
                    colItem.filter
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <hr />
      <div className='spell-desc'>{parse(spell.desc)}</div>
      <div className='d-flex justify-content-between'>
        <span className='card-subtext'>{materialDesc()}</span>
      </div>
    </>
  )

  return content
})

export default Spell
