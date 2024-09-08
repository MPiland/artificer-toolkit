import List from '../../components/List/List'
import { useGetCharactersQuery, useDeleteCharacterMutation } from './charactersApi'

const CharacterList = () => {
  return <List useGetItems={useGetCharactersQuery} useDeleteItem={useDeleteCharacterMutation} />
}

export default CharacterList
