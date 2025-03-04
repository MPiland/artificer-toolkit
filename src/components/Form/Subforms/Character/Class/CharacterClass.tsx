import { sprinkles } from '../../../../../css/sprinkles.css'
import Collapse from '../../../../Collapse/Collapse'
import Input from '../../../../Input/Input'
import { class_title, feature_card_header } from '../../../Character.css'
import Tabs from '../../../../Tabs/Tabs'
import Button from '../../../../Button/Button'
import ClassSpells from './ClassSpells'
import ClassProficiencies from './ClassProficiencies'
import ClassFeatures from './ClassFeatures'
import { Character, CharacterClass as CharacterClassType, Class } from '../../../../../../amplify/gql/types'
import { useGetSystemQuery } from '../../../../../features/systems/systemsApi'
import { UpdateState } from '../../../../../types/form'
import { parseDiceRoll } from '../../../../../utils/dice'
import { RollConfig } from '../../../../../types/components'
import Grid from '../../../../Grid/Grid'

const CharacterClass = ({
  uClass,
  fullClass,
  classIndex,
  handleRemoveClass,
  updateFormData,
  formData,
}: {
  uClass: CharacterClassType
  fullClass: Class
  classIndex: number
  handleRemoveClass: () => void
  updateFormData: (state: UpdateState<Character>) => void
  formData: Character
}) => {
  const { data: system } = useGetSystemQuery()

  const minLevelSpellcasting = fullClass.levelAttributes?.find(
    (levelAttribute) => levelAttribute.spellSlots?.length > 0
  )?.level

  const hitPointAbility = system.abilities.find((ability) => fullClass.hitpoint.ability === ability.id)

  const { numDie, dieType } = parseDiceRoll(fullClass.hitpoint.dieConfig as RollConfig)

  return (
    <Grid.Item>
      <Grid className={sprinkles({ mb: 'space-4' })}>
        <Grid.Item colSpan={'auto'} justify='start' align='end'>
          <h1 className={class_title}>{fullClass.label}</h1>
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
          {fullClass.spellcasting && uClass.level >= minLevelSpellcasting && <Tabs.Tab title='Spells' />}
        </Tabs.Header>
        <Tabs.Panel>
          <Grid>
            <Grid.Item>
              <Collapse>
                <Collapse.Header title='Hit Points' className={feature_card_header} />
                <Collapse.Body>
                  <div>
                    <strong>{'Hit Dice: '}</strong>
                    {`${fullClass.hitpoint?.dieConfig} per ${fullClass.label} level`}
                  </div>
                  <div>
                    <strong>{'Hit Points at 1st Level: '}</strong>
                    {`${numDie * dieType} + your ${hitPointAbility.label} modifier`}
                  </div>
                  <div>
                    <strong>{'Hit Points at Higher Levels: '}</strong>
                    {`${fullClass.hitpoint?.dieConfig} (or ${Math.round(numDie * (dieType / 2) + 0.5)}) + your ${
                      hitPointAbility.label
                    } modifier per ${fullClass.label} level after 1st`}
                  </div>
                </Collapse.Body>
              </Collapse>
            </Grid.Item>
            {fullClass.proficiencies?.length > 0 && (
              <ClassProficiencies
                fullClass={fullClass}
                uClass={uClass}
                classIndex={classIndex}
                formData={formData}
                updateFormData={updateFormData}
              />
            )}
            {fullClass.features && fullClass.features.length > 0 && (
              <ClassFeatures
                uClass={uClass}
                fullClass={fullClass}
                classIndex={classIndex}
                formData={formData}
                updateFormData={updateFormData}
              />
            )}
          </Grid>
        </Tabs.Panel>
        {fullClass.spellcasting && uClass.level >= minLevelSpellcasting && (
          <Tabs.Panel>
            <Grid>
              <ClassSpells
                uClass={uClass}
                fullClass={fullClass}
                classIndex={classIndex}
                formData={formData}
                updateFormData={updateFormData}
              />
            </Grid>
          </Tabs.Panel>
        )}
      </Tabs>
    </Grid.Item>
  )
}

export default CharacterClass
