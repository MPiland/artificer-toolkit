import { useLocation, useNavigate } from 'react-router-dom'
import {
  selectAllCharacters,
  useGetCharactersQuery,
} from './charactersApiSlice'
import useIsLoading from '../../hooks/useIsLoading'
import Spinner from '../../components/Spinner/Spinner'
import Group from '../../components/Group/Group'
import Button from '../../components/Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import Grid from '../../components/Grid/Grid'

const CharacterList = () => {
  const navigate = useNavigate()
  const isLoading = useIsLoading()
  const location = useLocation()

  const { characters } = useGetCharactersQuery(undefined, {
    selectFromResult: ({ data, isFetching }) => ({
      characters: data && selectAllCharacters(data),
      isFetching,
    }),
  })

  const handleCreate = () => {
    navigate(`/create/character`, {
      state: {
        background: location,
        context: { type: 'new', title: 'character' },
        form: 'character',
        data: characters,
        defaultCategory: null,
      },
    })
  }

  return isLoading ? (
    <Spinner />
  ) : (
    <Group className={sprinkles({ my: 'size-3' })}>
      <h1>Characters</h1>
      <Grid
        cols={{ lg: 1, md: 1, base: 1 }}
        className={sprinkles({ width: 'auto' })}
      >
        <Button type='button' variant='default' onClick={() => handleCreate()}>
          Create a Character
        </Button>
      </Grid>
    </Group>
  )
}

export default CharacterList
