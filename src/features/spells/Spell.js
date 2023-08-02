import parse from 'html-react-parser'
import { get, truncate } from 'lodash'
import { memo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const Spell = ({ state: spell }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const editSpell = () => {
    navigate(`/spells/edit/${spell.name}`, {
      state: { data: spell, previous: location },
    })
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
        const formattedValue = Array.isArray(value)
          ? value
              .map((nestedValue) =>
                shouldTruncate
                  ? truncate(nestedValue.value, {
                      length: truncateNum,
                      omission: '',
                    })
                  : nestedValue.value
              )
              .join(' / ')
          : shouldTruncate
          ? truncate(value, { length: truncateNum })
          : value
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
        return value !== undefined ? value : null
      }
    }

    return null
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
      <hr />
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
      <div>{parse(spell.desc)}</div>
      <div className='d-flex justify-content-end'>
        <button
          className='btn btn-outline-secondary btn-small'
          onClick={editSpell}
        >
          Edit
        </button>
      </div>
    </>
  )

  return content
}

const memoizedSpell = memo(Spell)

export default memoizedSpell
