import { useLocation } from 'react-router-dom'
import { useListClassesQuery } from '../classes/classesApi'
import { useListRacesQuery } from '../races/racesApi'
import { Character as CharacterState } from '../../../amplify/gql/types'

const Character = () => {
  const location = useLocation()

  const character: CharacterState = location.state.item
  const { data: classes } = useListClassesQuery()
  const { data: races } = useListRacesQuery()

  const charRace = races.find((race) => race.id === character.race)
  let charClass = ''
  let totalLevel = 0

  character.classes.forEach((cClass, index) => {
    const uClass = classes?.find((sClass) => sClass.id === cClass.id)
    totalLevel += cClass.level
    charClass = `(${cClass.level}) ${uClass.label}`
    if (cClass.subclass.id != null) {
      const subclass = classes?.find((sClass) => sClass.id === cClass.subclass.id)
      charClass += ` / ${subclass.label}`
    }
    if (index > 0) {
      charClass += ' / '
    }
  })

  return (
    <div className='col'>
      <div className='card h-100'>
        <div className='row g-0'>
          <div className='col-auto m-1'>
            <div>
              <i className='bi bi-eye'></i>
            </div>
            <div>
              <i className='bi bi-gear'></i>
            </div>
            <div>
              <i className='bi bi-trash3'></i>
            </div>
          </div>
          <div className='col-sm-3 m-1'>
            <img src='...' className='card-img-top' alt='...' />
          </div>
          <div className='col m-1'>
            <div className='card-body'>
              <h5 className='card-title'>{character.label}</h5>
              <p className='card-text'>{charRace.label}</p>
              <p className='card-text'>{`Level ${totalLevel} - ${charClass}`}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Character
