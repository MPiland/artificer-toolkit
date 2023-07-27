import { memo } from 'react'

const Spell = ({ spell }) => {
  const content = (
    <tr className='row-cols-lg-auto'>
      <td className='col-auto'>{spell.level}</td>
      <td className='col-auto'>{spell.name}</td>
      <td className='col-auto'>
        {spell.action.value} {spell.action.name}
      </td>
      <td className='col-auto'>
        {spell.duration.value} {spell.duration.name}
      </td>
      <td className='d-none d-lg-table-cell col-auto'>
        {spell.origin.name} {spell.origin.distance} {spell.shape && '/'}{' '}
        {spell.shape && spell.shape.name}{' '}
        {spell.shape && spell.shape.size + 'ft'}
      </td>
      <td className='d-none d-lg-table-cell col-auto'>
        {!!spell.damage.damageType
          ? spell.damage.damageType.map((typeItem, typeIndex) => {
              if (typeIndex !== spell.damage.damageType.length - 1) {
                return `${typeItem.name} / `
              } else return typeItem.name
            })
          : ''}
      </td>
    </tr>
  )

  return content
}

const memoizedSpell = memo(Spell)

export default memoizedSpell
