import { Route } from '@routes/_authed/characters/$characterId'
import { fetchClass, queryClient, useGetCharacter, useGetRace } from '@data/character'
import { useSuspenseQueries } from '@tanstack/react-query'

const Character = () => {
  const characterId = Route.useParams({ select: (r) => r.characterId })
  const character = useGetCharacter(characterId)

  const { data: charRace } = useGetRace(character?.race || '')

  let charClass = ''
  let totalLevel = 0

  const charStateClasses = [
    ...(character?.classes || []),
    ...(character?.classes?.filter((cClass) => cClass.subclass?.id != null).map((cClass) => cClass.subclass) || [])
  ]

  const { data: charClasses } = useSuspenseQueries({
    queries:
      charStateClasses?.map((uClass) => ({
        queryKey: ['character-classes', uClass?.id],
        queryFn: async () => await queryClient.fetchQuery(fetchClass(uClass?.id || ''))
      })) || [],
    combine: (result) => ({
      data: result.map((res) => res.data)
    })
  })

  character?.classes?.forEach((cClass, index) => {
    const uClass = charClasses?.find((uClass) => uClass?.id === cClass?.id)
    totalLevel += cClass.level
    charClass = `(${cClass.level}) ${uClass?.label}`
    if (cClass?.subclass?.id != null) {
      const subclass = charClasses?.find((uClass) => uClass?.id === cClass.subclass?.id)
      charClass += ` / ${subclass?.label}`
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
              <h5 className='card-title'>{character?.label}</h5>
              <p className='card-text'>{charRace?.label}</p>
              <p className='card-text'>{`Level ${totalLevel} - ${charClass}`}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Character
