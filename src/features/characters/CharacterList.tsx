import {
  selectAllCharacters,
  useGetCharactersQuery,
} from './charactersApiSlice'
import Character from './Character'
import Spinner from '../../components/Spinner/Spinner'

const CharacterList = () => {
  const { characters, isFetching } = useGetCharactersQuery('charactersList', {
    selectFromResult: ({ data, isFetching }) => ({
      characters: data && selectAllCharacters(data),
      isFetching,
    }),
  })

  let content

  if (isFetching) {
    return (content = <Spinner />)
  }

  content =
    characters?.length &&
    characters.map((character: any) => (
      <Character character={character} key={character._id} />
    ))

  content = (
    <div className='main-container'>
      <h1>Characters</h1>
      <div className='row row-cols-1 row-cols-lg-3 row-cols-md-2 g-4 m-3'>
        Test
      </div>
    </div>
  )

  return content
}

export default CharacterList
