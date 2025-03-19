import { useMemo } from 'react'
import Dropdown from '../../Dropdown/Dropdown'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import Scene from '../../Dice/Scene'
import { createPortal } from 'react-dom'
import { AbilityGenerate } from '../../../types/enums'
import { Character } from '../../../../amplify/gql/types'
import PointBuy from '../Subforms/Ability/PointBuy'
import StandardArray from '../Subforms/Ability/StandardArray'
import ManualArray from '../Subforms/Ability/ManualArray'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'
import AbilityCard from '../Subforms/Ability/AbilityCard'
import Grid from '../../Grid/Grid'
import Input from '../../Input/Input'
import Collapse from '../../Collapse/Collapse'

const AbilitiesForm = () => {
  const { data: system } = useGetSystemQuery()

  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (formData: UpdateState<Character>) => void
  }

  const form: HTMLFormElement = document.getElementById('form-content') as HTMLFormElement

  const pointSystem = useMemo(() => formData.abilities?.selectedSystem, [formData.abilities?.selectedSystem])

  return (
    <Grid>
      {form && createPortal(<Scene />, form)}
      <Grid.Item>
        <Grid>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='abilities.selectedSystem'
              options={system.rules.abilityGenerateMethod}
              label='Point System'
              value={formData.abilities?.selectedSystem}
              onChange={updateFormData}
            />
          </Grid.Item>
          {pointSystem === AbilityGenerate.manual && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                name='abilities.manualRolled.configuration'
                value={formData?.abilities?.manualRolled?.configuration}
                label='Dice Count'
                type='roll'
                onChange={updateFormData}
              />
            </Grid.Item>
          )}
        </Grid>
      </Grid.Item>
      {pointSystem === AbilityGenerate.pointBuy && <PointBuy formData={formData} updateFormData={updateFormData} />}
      {pointSystem === AbilityGenerate.manual && <ManualArray formData={formData} updateFormData={updateFormData} />}
      {pointSystem === AbilityGenerate.standardArray && (
        <StandardArray formData={formData} updateFormData={updateFormData} />
      )}
      <Grid.Item>
        <Collapse>
          <Collapse.Header title='Abilities' startOpened={true} />
          <Collapse.Body>
            <Grid>
              {formData.abilities?.scores?.map((score, index) => {
                const ability = system.abilities.find((ability) => ability.id === score.ability)
                return <AbilityCard key={index} score={score} ability={ability} />
              })}
            </Grid>
          </Collapse.Body>
        </Collapse>
      </Grid.Item>
    </Grid>
  )
}

export default AbilitiesForm
