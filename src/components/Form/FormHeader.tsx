import { form_header, error_message, success_message } from './Form.css'
import Group from '../Group/Group'
import { startCase } from 'lodash'
import Button from '../Button/Button'
import { useContext } from 'react'
import { FormStepsContext } from './FormStepsContext'

const FormHeader = () => {
  const {
    context,
    formState,
    setChangeRace,
    setAddClass,
    selectedClass,
    selectedRace,
    addClass,
    changeRace,
    stepName,
    errorMessage,
    successMessage,
  } = useContext(FormStepsContext)

  return (
    <div className={form_header}>
      <Group justifyContentVariant='spaceBetween'>
        <h1>
          {`${context.type === 'new' ? 'Create' : startCase(context.type)} ${
            context.title === 'item' ? ' An ' : ' A '
          }`}
          {startCase(context.title)}
          {formState?.value && ` (${formState.value})`}
        </h1>
        {selectedRace &&
          stepName === 'Race' &&
          (!changeRace ? (
            <Button
              variant='warning'
              onClick={() => {
                setChangeRace(true)
              }}
            >
              Change Race
            </Button>
          ) : (
            <Button
              variant='primary'
              onClick={() => {
                setChangeRace(false)
              }}
            >
              Keep Race
            </Button>
          ))}
        {selectedClass?.length > 0 &&
          stepName === 'Class' &&
          (!addClass ? (
            <Button
              variant='warning'
              onClick={() => {
                setAddClass(true)
              }}
            >
              Add Class
            </Button>
          ) : (
            <Button
              variant='warning'
              onClick={() => {
                setAddClass(false)
              }}
            >
              Cancel Add Class
            </Button>
          ))}
      </Group>
      {errorMessage && <span className={error_message}>{errorMessage}</span>}
      {successMessage && <span className={success_message}>{successMessage}</span>}
    </div>
  )
}

export default FormHeader
