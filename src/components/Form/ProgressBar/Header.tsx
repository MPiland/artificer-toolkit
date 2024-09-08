import { form_header } from '../Form.css'
import Group from '../../Group/Group'
import { startCase } from 'lodash'
import Button from '../../Button/Button'
import { useForm } from '../../../hooks/UseForm'
import ProgressBar from './ProgressBar'
import { titleText } from '../../../utils/formatting'

const Header = () => {
  const {
    context,
    formState,
    setChangeRace,
    setAddClass,
    addClass,
    changeRace,
    stepIndex,
    errorMessage,
    successMessage,
    steps,
  } = useForm()

  return (
    <>
      {steps.length > 1 && <ProgressBar />}
      <div className={form_header}>
        <Group justifyContentVariant='spaceBetween'>
          <h1>
            {`${context.type === 'new' ? 'Create' : startCase(context.type)} ${
              context.title === 'items' ? ' An ' : ' A '
            }`}
            {startCase(titleText(context.title as string))}
            {formState?.value && ` (${formState.value})`}
          </h1>
          {formState.race &&
            steps[stepIndex].name === 'Race' &&
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
          {formState.class?.length > 0 &&
            steps[stepIndex].name === 'Class' &&
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
        </Group>
        {errorMessage && <span>{errorMessage}</span>}
        {successMessage && <span>{successMessage}</span>}
      </div>
    </>
  )
}

export default Header
