import { useEffect } from 'react'
import { sprinkles } from '../../../../css/sprinkles.css'
import Collapse from '../../../Collapse/Collapse'
import Group from '../../../Group/Group'
import Input from '../../../Input/Input'
import Row from '../../../Row/Row'
import { useGetClassesQuery } from '../../../../features/classes/classesApi'
import { class_title, feature_card_header } from '../Character.css'
import { useForm } from '../../../../hooks/UseForm'
import Tabs from '../../../Tabs/Tabs'
import Button from '../../../Button/Button'
import ClassSpells from './ClassSpells'
import ClassProficiencies from './ClassProficiencies'
import ClassFeatures from './ClassFeatures'

const ClassContainer = ({ uClass }: { uClass: any }) => {
  const { formState, setFormState } = useForm()

  const { data: classes } = useGetClassesQuery() as { data: any[] }

  const classIndex = formState.class.findIndex((fClass: any) => fClass._id === uClass._id)

  const fullClass = classes?.find((classItem: any) => uClass._id === classItem._id)

  // Set class hitpoints
  useEffect(() => {
    if (uClass?.hitpoint?.level !== uClass?.level) {
      setFormState({
        target: {
          name: `class.${classIndex}.hitpoint.total`,
          value: uClass?.level,
        },
      })
    }
  }, [setFormState, classIndex, uClass])

  const handleRemoveClass = () => {
    const updatedClasses = formState.class.filter((_: any, index: number) => classIndex !== index)

    if (formState.class?.length === 1) {
      setFormState({
        type: 'removed',
        target: {
          name: `class`,
        },
      })
    } else {
      setFormState({
        target: {
          name: `class`,
          value: updatedClasses,
        },
      })
    }
  }

  const minLevelSpellcasting = uClass.levelAttribute?.find(
    (levelAttribute: any) => levelAttribute.spellSlots?.length > 0
  )?.level

  return (
    <>
      <Group
        directionVariant='row'
        justifyContentVariant='spaceBetween'
        alignItemsVariant='end'
        className={sprinkles({ mb: 'space-3' })}
      >
        <Group>
          <h1 className={class_title}>{uClass.value}</h1>
          <Button color='danger' style='outline' onClick={() => handleRemoveClass()}>
            Remove Class
          </Button>
        </Group>
        <Row cols={{ base: 1 }} className={sprinkles({ width: 'size-auto' })}>
          <Input
            label='Level'
            name={`class.${classIndex}.level`}
            value={formState.class[classIndex].level}
            errorMsg='Enter whole numbers only.'
            validation='num'
            onChange={setFormState}
          />
        </Row>
      </Group>
      <Tabs style='borderless'>
        <Tabs.Header>
          <Tabs.Tab title='Class Features' />
          {uClass.spellcasting && uClass.level >= minLevelSpellcasting && <Tabs.Tab title='Spells' />}
        </Tabs.Header>
        <Tabs.Panel>
          <Collapse>
            <Collapse.Header title='Hit Points' className={feature_card_header} />
            <Collapse.Body>
              <div>
                <strong>{'Hit Dice: '}</strong>
                {`${uClass.hitpoint?.diceShort} per ${fullClass.value} level`}
              </div>
              <div>
                <strong>{'Hit Points at 1st Level: '}</strong>
                {`${uClass.hitpoint?.diceCount * fullClass.hitpoint?.diceValue.value} + your ${
                  uClass.hitpoint?.ability?.value
                } modifier`}
              </div>
              <div>
                <strong>{'Hit Points at Higher Levels: '}</strong>
                {`${uClass.hitpoint?.diceShort} (or ${Math.round(
                  uClass.hitpoint?.diceCount * (uClass.hitpoint?.diceValue.value / 2) + 0.5
                )}) + your ${uClass.hitpoint?.ability?.value} modifier per ${uClass.value} level after 1st`}
              </div>
            </Collapse.Body>
          </Collapse>
          {fullClass.proficiencies?.length > 0 && (
            <ClassProficiencies fullClass={fullClass} uClass={uClass} classIndex={classIndex} />
          )}
          {fullClass.features && fullClass.features.length > 0 && (
            <ClassFeatures uClass={uClass} classIndex={classIndex} fullClass={fullClass} />
          )}
        </Tabs.Panel>
        {uClass.spellcasting && uClass.level >= minLevelSpellcasting && (
          <Tabs.Panel>
            <ClassSpells uClass={uClass} classIndex={classIndex} />
          </Tabs.Panel>
        )}
      </Tabs>
    </>
  )
}

export default ClassContainer
