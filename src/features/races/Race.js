import parse from 'html-react-parser'
import { useOutletContext } from 'react-router-dom'

const Race = () => {
  const { data: race } = useOutletContext()

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
}

export default Race
