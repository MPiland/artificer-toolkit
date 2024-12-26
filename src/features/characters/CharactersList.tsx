import List from '../../components/List/List'
import { useListCharactersQuery, useDeleteCharacterMutation } from './charactersApi'

const CharacterList = () => {
  return <List useListItems={useListCharactersQuery} useDeleteItem={useDeleteCharacterMutation} />
}

export default CharacterList
