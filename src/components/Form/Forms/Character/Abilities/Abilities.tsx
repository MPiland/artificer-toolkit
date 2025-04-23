import { useMemo } from 'react'
import Dropdown from '../../../../Dropdown/Dropdown'
import Scene from '../../../../Dice/Scene'
import { createPortal } from 'react-dom'
import { AbilityGenerate } from '../../../../../types/enums'
import { Character } from '../../../../../../amplify/gql/types'
import PointBuy from '../../../Subforms/Character/Ability/PointBuy'
import StandardArray from '../../../Subforms/Character/Ability/StandardArray'
import ManualArray from '../../../Subforms/Character/Ability/ManualArray'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import AbilityCard from '../../../Subforms/Character/Ability/AbilityCard'
import Grid from '../../../../Grid/Grid'
import Input from '../../../../Input/Input'
import Collapse from '../../../../Collapse/Collapse'
import useSystemData from '../../../../../hooks/useSystemData'
import { OnChange } from '../../../../../types/types'
import type { FormStore } from '../../../../../store/formStore'

const AbilitiesForm = () => {
  const {
    rules,
    abilities: { findAbility },
  } = useSystemData()
  const { formStore } = use(FormContext) as {
    formStore: FormStore<Character>
  }

  const {
    data,
    updateField,
    removeField,
  }: {
    data: Character
    updateField: OnChange<Character>['updateField']
    removeField: OnChange<Character>['removeField']
  } = formStore

  const form: HTMLFormElement = document.getElementById('form-content') as HTMLFormElement

  const pointSystem = useMemo(() => data.abilities?.selectedSystem, [data.abilities?.selectedSystem])

  return (
    <Grid>
      {form && createPortal(<Scene />, form)}
      <Grid.Item>
        <Grid>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='abilities.selectedSystem'
              options={rules.abilityGenerateMethod}
              label='Point System'
              value={data.abilities?.selectedSystem}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          {pointSystem === AbilityGenerate.manual && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                name='abilities.manualRolled.configuration'
                value={data?.abilities?.manualRolled?.configuration}
                label='Dice Count'
                type='roll'
                onChange={{ updateField }}
              />
            </Grid.Item>
          )}
        </Grid>
      </Grid.Item>
      {pointSystem === AbilityGenerate.pointBuy && <PointBuy formStore={formStore} />}
      {pointSystem === AbilityGenerate.manual && <ManualArray formStore={formStore} />}
      {pointSystem === AbilityGenerate.standardArray && <StandardArray formStore={formStore} />}
      <Grid.Item>
        <Collapse>
          <Collapse.Header title='Abilities' startOpened={true} />
          <Collapse.Body>
            <Grid>
              {data.abilities?.scores?.map((score, index) => {
                const ability = findAbility(score.ability)
                if (ability) {
                  return <AbilityCard key={index} score={score} ability={ability} />
                }
              })}
            </Grid>
          </Collapse.Body>
        </Collapse>
      </Grid.Item>
    </Grid>
  )
}

export default AbilitiesForm
