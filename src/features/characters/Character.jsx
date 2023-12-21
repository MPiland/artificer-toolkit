import { memo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy } from '@fortawesome/free-regular-svg-icons'

const Character = ({ character }) => {
  const numClass = character.class.length
  const charName = character.name

  let charRace = ''
  let charClass = ''
  let totalLevel = 0

  if (numClass === 1) {
    totalLevel = character.totalLevel
    if (character.class[0].subclass.name !== '') {
      charClass = `${character.class[0].name} / ${character.class[0].subclass.name}`
    } else {
      charClass = `${character.class[0].name}`
    }
  } else {
    for (let i = 0; i < numClass; i++) {
      totalLevel += character.class[i].level
      const level = character.class[i].level
      const className = character.class[i].name
      if (character.class[i].subclass.name !== '') {
        if (character.class[0].subclass.name !== '') {
          charClass += `(${level}) ${className} ${character.class[i].subclass.name}`
        } else {
          charClass += `(${level}) ${className}`
        }
      }
      if (i !== numClass - 1) {
        charClass += ' / '
      }
    }
  }

  if (character.race.subrace !== '') {
    charRace = character.race.subrace
  } else {
    charRace = character.race.name
  }

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
              <FontAwesomeIcon icon={faCopy} />
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
              <h5 className='card-title'>{charName}</h5>
              <p className='card-text'>{charRace}</p>
              <p className='card-text'>{`Level ${totalLevel} - ${charClass}`}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
const memoizedCharacter = memo(Character)

export default memoizedCharacter
