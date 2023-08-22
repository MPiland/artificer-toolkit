import '../../scss/card.scss'
import parse from 'html-react-parser'
import { forwardRef } from 'react'

const Race = forwardRef(({ state: race }, ref) => {
  const content = (
    <>
      <div className='card-desc'>{race?.desc && parse(race.desc)}</div>
      <div className='card-desc'>{race?.quote && parse(race.quote)}</div>
      <hr />
      <h4>Traits</h4>
      <div className='card-desc'>{race?.quote && parse(race.traits.desc)}</div>
    </>
  )

  return content
})

export default Race
