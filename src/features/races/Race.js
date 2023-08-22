import parse from 'html-react-parser'
import { forwardRef } from 'react'

const Race = forwardRef(({ state: race }, ref) => {
  const content = (
    <div className='detailCard-body'>
      <div>{race?.quote && parse(race.quote)}</div>
      <div>{race?.desc && parse(race.desc)}</div>
      <hr />
      <h4>Traits</h4>
      <div>{race?.traits && parse(race.traits.desc)}</div>
    </div>
  )

  return content
})

export default Race
