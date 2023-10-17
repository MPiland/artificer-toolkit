import parse from 'html-react-parser'
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import { getValueFromState } from '../../helpers/formatting'

const Spell = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: spell, handleClose } = useOutletContext()

  const data = location.state.data

  const onEditClicked = () => {
    navigate(
      `${location.state.background.pathname}/edit/${location.state.data.name}`,
      {
        state: { data: data, previous: location },
      }
    )
  }

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
    <>
      <div className='modal-header'>
        <h1 className='fw-bold mb-0 fs-2 ms-auto'>{spell.value}</h1>
        <button
          type='button'
          className='btn-close'
          aria-label='Close'
          onClick={handleClose}
        ></button>
      </div>
      <div className='modal-body detail-card'>
        <div className='detail-card-detail row row-cols-lg-4 row-cols-md-3 row-cols-2 gy-3'>
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
        <div>{parse(spell.desc)}</div>
        <div className='d-flex justify-content-between'>
          <span className='detail-card-subtext'>{materialDesc()}</span>
        </div>
      </div>
      <div className='modal-footer'>
        <button
          className='btn btn-outline-secondary btn-small'
          onClick={onEditClicked}
        >
          Edit
        </button>
      </div>
    </>
  )

  return content
}

export default Spell
