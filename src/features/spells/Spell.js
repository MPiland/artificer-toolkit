import { memo } from 'react'

const Spell = ({ spell }) => {
  const content = (
    <tr className='row-cols-lg-auto'>
      <td className='col-auto'>{spell.level}</td>
      <td className='col-auto'>{spell.name}</td>
      <td className='col-auto'>
        {spell.casting.value} {spell.casting.name}
      </td>
      <td className='col-auto'>
        {spell.duration.value} {spell.duration.name}
      </td>
      <td className='d-none d-lg-table-cell col-auto'>
        {spell.origin.name} {spell.origin.distance} {spell.area && '/'}{' '}
        {spell.area && spell.area.name} {spell.area && spell.area.size + 'ft'}
      </td>
      <td className='d-none d-lg-table-cell col-auto'>
        {spell.effect.map((effect, i) => {
          if (effect.damage) {
            if (i !== spell.effect.length - 1) {
              return `${effect.damage.name} / `
            } else return effect.damage.name
          } else return ''
        })}
      </td>
    </tr>
  )

  return content
}

const memoizedSpell = memo(Spell)

export default memoizedSpell
