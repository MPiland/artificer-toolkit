import parse from 'html-react-parser'
import { useOutletContext } from 'react-router-dom'
import { getValueFromState } from '../../helpers/formatting'

const Spell = () => {
  const { data: spell } = useOutletContext()

  const materialDesc = () => {
    if (spell.materialDesc) {
      return '*' + spell.materialDesc
    } else return ''
  }

  const cols = [
    { header: 'LEVEL', name: 'level' },
    {
      header: 'CASTING TIME',
      name: ['action.value', 'action.actionType.value'],
    },
    {
      header: 'RANGE/AREA',
      name: [
        ['range.rangeType.value', 'range.distance'],
        ['shape.shapeType.value', 'shape.size'],
      ],
    },
    { header: 'REQUIREMENTS', name: 'requirement', truncate: 1 },
    {
      header: 'DURATION',
      name: ['duration.value', 'duration.durationType.value'],
    },
    { header: 'SCHOOL', name: 'school.value' },
    {
      header: 'SAVE ABILITY',
      name: 'saveAbility.value',
      filter: ['isAttack', 'requireSave'],
    },
    { header: 'DAMAGE', name: 'damage.damageType' },
  ]

  const content = (
    <div className='detailCard-body container'>
      <div className='detailCard-detail row row-cols-lg-4 row-cols-md-3 row-cols-2 gy-3'>
        {cols.map((colItem, colIndex) => {
          return (
            <div className='col' key={colIndex}>
              <div className='fw-bold'>{colItem.header}</div>
              <div>{getValueFromState(colItem, spell, colItem.truncate)}</div>
            </div>
          )
        })}
      </div>
      <hr />
      <div className='detailCard-body'>
        <div>{parse(spell.desc)}</div>
        <div className='d-flex justify-content-between'>
          <span className='detailCard-subtext'>{materialDesc()}</span>
        </div>
      </div>
    </div>
  )

  return content
}

export default Spell
