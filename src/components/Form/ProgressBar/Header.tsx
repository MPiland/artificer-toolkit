import { form_header } from '../Form.css'
import Group from '../../Group/Group'
import { startCase } from 'lodash'
import Button from '../../Button/Button'
import { use } from 'react'
import FormContext from '../FormContext'
import ProgressBar from './ProgressBar'
import { titleText } from '../../../utils/formatting'

const Header = () => {
  const {
    context,
    formData,
    setChangeRace,
    setAddClass,
    addClass,
    changeRace,
    stepIndex,
    errorMessage,
    successMessage,
    steps,
  } = use(FormContext)

  return (
    <>
      {steps.length > 1 && <ProgressBar />}
      <div className={form_header}>
        <Group justifyContentVariant='spaceBetween'>
          <h1>
            {`${context.type === 'new' ? 'Create' : startCase(context.type)} ${
              formData.__typename === 'Character' ? ' An ' : ' A '
            }`}
            {startCase(titleText(context.title as string))}
            {formData?.value && ` (${formData.value})`}
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
      </div>
    </>
  )
}

export default Header
