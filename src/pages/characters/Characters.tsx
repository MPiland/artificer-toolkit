import { Suspense } from 'react'
import List from '@/components/List'
import { useDeleteCharacter } from '@/apis/charactersApi'
import Loading from '@/components/Loading'
import { useCharacterData } from '@/hooks'

const Characters = () => {
  const { characters } = useCharacterData()
  return (
    <Suspense fallback={<Loading />}>
      <List data={characters} useDeleteItem={useDeleteCharacter} />
    </Suspense>
  )
}

export default Characters
