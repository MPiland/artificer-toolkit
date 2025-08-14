import { Group, Button } from '@mantine/core'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import Stepper from './Stepper'

const Header = () => {
  const store = useTypedFormStore()
  const { __kind, label, stepIndex, steps, addClass, changeRace, setChangeRace, classes, setAddClass } =
    useOptimizedSelector(store, (state) => ({
      __kind: state.current?.__kind,
      label: state.current?.label,
      stepIndex: state.meta.stepIndex,
      steps: state.meta.steps,
      addClass: state.meta.addClass,
      changeRace: state.meta.changeRace,
      setChangeRace: state.setChangeRace,
      classes: state.current?.__kind === 'CharacterInput' ? state.current?.classes : undefined,
      setAddClass: state.setAddClass,
    }))

  return (
    <>
      {steps.length > 1 && <Stepper />}
      <Group justify='space-between'>
        <h1>
          {label ? ` ${label}` : `Create ${__kind === 'CharacterInput' ? 'an ' : 'a '} ${__kind?.replace('Input', '')}`}
        </h1>
        {__kind === 'CharacterInput' && (
          <>
            {steps[stepIndex]?.label === 'Race' &&
              (!changeRace ?
                <Button
                  color='update'
                  onClick={() => {
                    setChangeRace(true)
                  }}
                >
                  Change Race
                </Button>
              : <Button
                  color='danger'
                  onClick={() => {
                    setChangeRace(false)
                  }}
                >
                  Keep Race
                </Button>)}
            {classes?.length &&
              steps[stepIndex].label === 'Class' &&
              (!addClass ?
                <Button
                  color='update'
                  onClick={() => {
                    setAddClass(true)
                  }}
                >
                  Add Class
                </Button>
              : <Button
                  color='danger'
                  onClick={() => {
                    setAddClass(false)
                  }}
                >
                  Cancel Add Class
                </Button>)}
          </>
        )}
      </Group>
    </>
  )
}

export default Header
