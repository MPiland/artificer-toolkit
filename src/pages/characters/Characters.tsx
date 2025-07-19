import List from '@/components/List'
import { useDeleteCharacter } from '@/apis/characters.api'
import { useCharacterData } from '@/hooks'

const Characters = () => {
  const { characters } = useCharacterData()
  return <List data={characters} useDeleteItem={useDeleteCharacter} />
}

export default Characters
