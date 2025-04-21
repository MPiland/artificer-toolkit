import { Suspense } from 'react'
import List from '../../components/List/List'
import { useDeleteCharacter } from '../../apis/charactersApi'
import Loading from '../../components/Loading/Loading'
import useCharacterData from '../../hooks/useCharacterData'

const Characters = () => {
  const { all: characters } = useCharacterData()
  return (
    <Suspense fallback={<Loading />}>
      <List data={characters} useDeleteItem={useDeleteCharacter} />
    </Suspense>
  )
}

export default Characters
