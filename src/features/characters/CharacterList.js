import { useGetCharacterQuery } from './charactersApiSlice'
import Character from './Character'
import useAuth from '../../hooks/useAuth'

const CharacterList = () => {
  const { id } = useAuth()

  const {
    data: characters,
    isLoading,
    isSuccess,
    isError,
    error,
  } = useGetCharacterQuery(id, {
    refetchOnMountOrArgChange: true,
  })

  let content

  if (isLoading) content = <p>Loading...</p>

  if (isError) {
    content = <p>{error?.data?.message}</p>
  }

  if (isSuccess) {
    content =
      characters?.length &&
      characters.map((character) => (
        <Character character={character} key={character._id} />
      ))
  }

  return (
    <>
      <h1>Characters</h1>
      <div className='row row-cols-1 row-cols-lg-3 row-cols-md-2 g-4 m-3'>
        {content}
      </div>
    </>
  )
}

export default CharacterList
