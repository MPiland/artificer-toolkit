import ProgressBar from './ProgressBar'
import { sprinkles } from '@/css/sprinkles.css'
import { Grid, Group, Button } from '@mantine/core'
import { useFormStore } from '@/store'

const Header = () => {
  const formStore = useFormStore()
  const { addClass, changeRace, stepIndex, steps } = formStore

  return (
    <Grid className={sprinkles({ mb: 'space-4' })}>
      {steps.length > 1 && <ProgressBar />}
      <Grid.Col>
        <Group justify='space-between'>
          <h1>
            {`${formStore.current?.id == null ? 'Create' : formStore.current?.__kind} ${
              formStore.current?.__kind === 'CharacterInput' ? ' An ' : ' A '
            }`}
            {formStore.current?.__kind}
            {formStore.current?.label && ` (${formStore.current?.label})`}
          </h1>
          {formStore.current?.__kind === 'CharacterInput' && (
            <>
              {steps[stepIndex]?.label === 'Race' &&
                (!changeRace ?
                  <Button
                    color='update'
                    onClick={() => {
                      formStore.setChangeRace(true)
                    }}
                  >
                    Change Race
                  </Button>
                : <Button
                    color='danger'
                    onClick={() => {
                      formStore.setChangeRace(false)
                    }}
                  >
                    Keep Race
                  </Button>)}
              {formStore.current?.classes?.length &&
                steps[stepIndex].label === 'Class' &&
                (!addClass ?
                  <Button
                    color='update'
                    onClick={() => {
                      formStore.setAddClass(true)
                    }}
                  >
                    Add Class
                  </Button>
                : <Button
                    color='danger'
                    onClick={() => {
                      formStore.setAddClass(false)
                    }}
                  >
                    Cancel Add Class
                  </Button>)}
            </>
          )}
        </Group>
      </Grid.Col>
    </Grid>
  )
}

export default Header
