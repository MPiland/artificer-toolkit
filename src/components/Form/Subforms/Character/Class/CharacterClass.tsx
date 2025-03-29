import { sprinkles } from '../../../../../css/sprinkles.css'
import Collapse from '../../../../Collapse/Collapse'
import Input from '../../../../Input/Input'
import { class_title, feature_card_header } from '../../../Character.css'
import Tabs from '../../../../Tabs/Tabs'
import Button from '../../../../Button/Button'
import ClassSpells from './ClassSpells'
import ClassProficiencies from './ClassProficiencies'
import ClassFeatures from './features/ClassFeatures'
import { Character, CharacterClass as CharacterClassType } from '../../../../../../amplify/gql/types'
import { useGetSystemQuery } from '../../../../../apis/systemsApi'
import { UpdateState } from '../../../../../types/form'
import { parseDiceRoll } from '../../../../../utils/dice'
import { RollConfig } from '../../../../../types/components'
import Grid from '../../../../Grid/Grid'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import { useListClassesQuery } from '../../../../../apis/classesApi'

const CharacterClass = <T extends Character>({
  uClass,
  classIndex,
  handleRemoveClass,
}: {
  uClass: CharacterClassType
  classIndex: number
  handleRemoveClass: () => void
}) => {
  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()

  const { updateFormData } = use(FormContext) as {
    updateFormData: (state: UpdateState<T>) => void
  }

  const fullClass = classes.find((c) => c.id === uClass.id)
  const subclasses = classes.filter((sClass) => sClass.parentClass === uClass.id)

  const minLevelSpellcasting = fullClass?.levelAttributes?.find(
    (levelAttribute) => levelAttribute?.spellSlots?.length
  )?.level

  const hitPointAbility = system.abilities.find((ability) => fullClass?.hitpoint?.ability === ability.id)

  const { quantity, die } = parseDiceRoll(fullClass?.hitpoint?.dieConfig as RollConfig)

  return (
    <Grid.Item>
      <Grid className={sprinkles({ mb: 'space-4' })}>
        <Grid.Item colSpan={'auto'} justify='start' align='end'>
          <h1 className={class_title}>{fullClass?.label}</h1>
          <Button color='danger' style='outline' onClick={() => handleRemoveClass()}>
            Remove Class
          </Button>
        </Grid.Item>
        <Grid.Item colSpan={2}>
          <Input
            label='Level'
            name={`classes.${classIndex}.level`}
            value={uClass.level}
            errorMsg='Enter whole numbers only.'
            validation='num'
            onChange={updateFormData}
          />
        </Grid.Item>
      </Grid>
      <Tabs style='borderless'>
        <Tabs.Header>
          <Tabs.Tab title='Class Features' />
          {minLevelSpellcasting && fullClass?.spellcasting && uClass.level >= minLevelSpellcasting && (
            <Tabs.Tab title='Spells' />
          )}
        </Tabs.Header>
        <Tabs.Panel>
          <Grid>
            <Grid.Item>
              <Collapse>
                <Collapse.Header title='Hit Points' className={feature_card_header} />
                <Collapse.Body>
                  <div>
                    <strong>{'Hit Dice: '}</strong>
                    {`${fullClass?.hitpoint?.dieConfig} per ${fullClass?.label} level`}
                  </div>
                  <div>
                    <strong>{'Hit Points at 1st Level: '}</strong>
                    {`${quantity * die} + your ${hitPointAbility?.label} modifier`}
                  </div>
                  <div>
                    <strong>{'Hit Points at Higher Levels: '}</strong>
                    {`${fullClass?.hitpoint?.dieConfig} (or ${Math.round(quantity * (die / 2) + 0.5)}) + your ${
                      hitPointAbility?.label
                    } modifier per ${fullClass?.label} level after 1st`}
                  </div>
                </Collapse.Body>
              </Collapse>
            </Grid.Item>
            {fullClass?.proficiencies?.length && <ClassProficiencies fullClass={fullClass} classIndex={classIndex} />}
            {fullClass?.features && fullClass?.features.length && (
              <ClassFeatures uClass={uClass} fullClass={fullClass} subclasses={subclasses} classIndex={classIndex} />
            )}
          </Grid>
        </Tabs.Panel>
        {minLevelSpellcasting && fullClass?.spellcasting && uClass.level >= minLevelSpellcasting && (
          <Tabs.Panel>
            <Grid>
              <ClassSpells fullClass={fullClass} uClass={uClass} classIndex={classIndex} />
            </Grid>
          </Tabs.Panel>
        )}
      </Tabs>
    </Grid.Item>
  )
}

export default CharacterClass
