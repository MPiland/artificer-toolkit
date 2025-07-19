import { Group, Button } from '@mantine/core'
import { useFormStore } from '@/store'
import Stepper from './Stepper'

const Header = () => {
  const __kind = useFormStore((state) => state.current?.__kind)
  const label = useFormStore((state) => state.current?.label)
  const stepIndex = useFormStore((state) => state.stepIndex)
  const steps = useFormStore((state) => state.steps)
  const addClass = useFormStore((state) => state.addClass)
  const changeRace = useFormStore((state) => state.changeRace)
  const setChangeRace = useFormStore((state) => state.setChangeRace)
  const classes = useFormStore((state) =>
    state.current?.__kind === 'CharacterInput' ? state.current?.classes : undefined
  )
  const setAddClass = useFormStore((state) => state.setAddClass)

  return (
    <>
      {steps.length > 1 && <Stepper />}
      <Group justify='space-between'>
        <h1>
          {label ? ` ${label}` : `Create ${__kind === 'CharacterInput' ? 'an ' : 'a '} ${__kind}`}
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
