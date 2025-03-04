import Group from '../../Group/Group'
import Button from '../../Button/Button'
import { use } from 'react'
import { FormContext } from '../FormContext'
import ProgressBar from './ProgressBar'
import CharacterHeader from './CharacterHeader'
import Grid from '../../Grid/Grid'
import { sprinkles } from '../../../css/sprinkles.css'

const Header = () => {
  const { formData, setChangeRace, setAddClass, addClass, changeRace, stepIndex, errorMessage, successMessage, steps } =
    use(FormContext)

  return (
    <Grid className={sprinkles({ mb: 'space-4' })}>
      {steps.length > 1 && <ProgressBar />}
      <Grid.Item>
        <Group justifyContentVariant='spaceBetween'>
          <h1>
            {`${formData.id == null ? 'Create' : formData.__typename} ${
              formData.__typename === 'Character' ? ' An ' : ' A '
            }`}
            {formData.__typename}
            {formData?.label && ` (${formData.label})`}
          </h1>
          {formData.__typename === 'Character' && (
            <>
              {steps[stepIndex]?.label === 'Race' &&
                (!changeRace ? (
                  <Button
                    color='update'
                    onClick={() => {
                      setChangeRace(true)
                    }}
                  >
                    Change Race
                  </Button>
                ) : (
                  <Button
                    color='danger'
                    onClick={() => {
                      setChangeRace(false)
                    }}
                  >
                    Keep Race
                  </Button>
                ))}
              {formData.classes?.length > 0 &&
                steps[stepIndex].label === 'Class' &&
                (!addClass ? (
                  <Button
                    color='update'
                    onClick={() => {
                      setAddClass(true)
                    }}
                  >
                    Add Class
                  </Button>
                ) : (
                  <Button
                    color='danger'
                    onClick={() => {
                      setAddClass(false)
                    }}
                  >
                    Cancel Add Class
                  </Button>
                ))}
            </>
          )}
        </Group>
        {errorMessage && <span>{errorMessage}</span>}
        {successMessage && <span>{successMessage}</span>}
      </Grid.Item>
      {formData.__typename === 'Character' && <CharacterHeader />}
    </Grid>
  )
}

export default Header
