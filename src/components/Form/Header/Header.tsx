import Button from '@/components/Button'
import { use } from 'react'
import { FormContext } from '../FormContext'
import ProgressBar from './ProgressBar'
import CharacterHeader from './CharacterHeader'
import { sprinkles } from '@/css/sprinkles.css'
import { Grid, Group } from '@mantine/core'

const Header = () => {
  const { formStore, addClass, changeRace, stepIndex, errorMessage, successMessage, steps } = use(FormContext)

  return (
    <Grid className={sprinkles({ mb: 'space-4' })}>
      {steps.length > 1 && <ProgressBar />}
      <Grid.Col>
        <Group justify='space-between'>
          <h1>
            {`${formStore.data.id == null ? 'Create' : formStore.data.__typename} ${
              formStore.data.__typename === 'Character' ? ' An ' : ' A '
            }`}
            {formStore.data.__typename}
            {formStore.data?.label && ` (${formStore.data.label})`}
          </h1>
          {formStore.data.__typename === 'Character' && (
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
              {formStore.data.classes?.length &&
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
        {errorMessage && <span>{errorMessage}</span>}
        {successMessage && <span>{successMessage}</span>}
      </Grid.Col>
      {formStore.data.__typename === 'Character' && <CharacterHeader />}
    </Grid>
  )
}

export default Header
