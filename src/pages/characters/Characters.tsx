import { Suspense } from 'react'
import List from '../../components/List/List'
import { useListCharactersQuery, useDeleteCharacterMutation } from '../../apis/charactersApi'
import Loading from '../../components/Loading/Loading'

const Characters = () => {
  return (
    <Suspense fallback={<Loading />}>
      <List useListItems={useListCharactersQuery} useDeleteItem={useDeleteCharacterMutation} />
    </Suspense>
  )
}

export default Characters
