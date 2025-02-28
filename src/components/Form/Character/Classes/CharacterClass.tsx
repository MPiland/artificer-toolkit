import { sprinkles } from '../../../../css/sprinkles.css'
import Collapse from '../../../Collapse/Collapse'
import Group from '../../../Group/Group'
import Input from '../../../Input/Input'
import Row from '../../../Row/Row'
import { class_title, feature_card_header } from '../Character.css'
import Tabs from '../../../Tabs/Tabs'
import Button from '../../../Button/Button'
import ClassSpells from './ClassSpells'
import ClassProficiencies from './ClassProficiencies'
import ClassFeatures from './ClassFeatures'
import { Character, CharacterClass as CharacterClassType, Class } from '../../../../../amplify/gql/types'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { UpdateState } from '../../../../types/form'
import { parseDiceRoll } from '../../../../utils/dice'
import { RollConfig } from '../../../../types/components'

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
    <>
      <Group
        directionVariant='row'
        justifyContentVariant='spaceBetween'
        alignItemsVariant='end'
        className={sprinkles({ mb: 'space-3' })}
      >
        <Group>
          <h1 className={class_title}>{fullClass.label}</h1>
          <Button color='danger' style='outline' onClick={() => handleRemoveClass()}>
            Remove Class
          </Button>
        </Group>
        <Row cols={{ base: 1 }} className={sprinkles({ width: 'size-auto' })}>
          <Input
            label='Level'
            name={`classes.${classIndex}.level`}
            value={uClass.level}
            errorMsg='Enter whole numbers only.'
            validation='num'
            onChange={updateFormData}
          />
        </Row>
      </Group>
      <Tabs style='borderless'>
        <Tabs.Header>
          <Tabs.Tab title='Class Features' />
          {fullClass.spellcasting && uClass.level >= minLevelSpellcasting && <Tabs.Tab title='Spells' />}
        </Tabs.Header>
        <Tabs.Panel>
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
        </Tabs.Panel>
        {fullClass.spellcasting && uClass.level >= minLevelSpellcasting && (
          <Tabs.Panel>
            <ClassSpells
              uClass={uClass}
              fullClass={fullClass}
              classIndex={classIndex}
              formData={formData}
              updateFormData={updateFormData}
            />
          </Tabs.Panel>
        )}
      </Tabs>
    </>
  )
}

export default CharacterClass
