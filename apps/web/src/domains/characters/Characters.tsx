import List from '~components/List'
import { useDeleteCharacter, useListCharacters } from '~apis'

const Characters = () => {
  const characters = useListCharacters()
  return <List data={characters} useDeleteItem={useDeleteCharacter} />
}

export default Characters
