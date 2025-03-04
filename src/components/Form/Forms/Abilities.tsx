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

const AbilitiesForm = () => {
  const { data: system } = useGetSystemQuery()

  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (formData: UpdateState<Character>) => void
  }

  const form: HTMLFormElement = document.getElementById('form_content') as HTMLFormElement

  const pointSystem = useMemo(() => formData.abilities?.selectedSystem, [formData.abilities?.selectedSystem])

  console.log({ test: pointSystem === AbilityGenerate.manual })

  return (
    <Grid>
      {form && createPortal(<Scene />, form)}
      <Grid.Item>
        <Grid>
          <Grid.Item colSpan={2}>
            <Dropdown
              name='abilities.selectedSystem'
              options={system.rules.abilityGenerateMethod}
              label='Point System'
              value={formData.abilities?.selectedSystem}
              onChange={updateFormData}
            />
          </Grid.Item>
          {pointSystem === AbilityGenerate.manual && (
            <Grid.Item colSpan={2}>
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
      {pointSystem === AbilityGenerate.pointBuy && (
        <Grid.Item>
          <PointBuy formData={formData} updateFormData={updateFormData} />
        </Grid.Item>
      )}
      {pointSystem === AbilityGenerate.manual && <ManualArray formData={formData} updateFormData={updateFormData} />}
      {pointSystem === AbilityGenerate.standardArray && (
        <Grid.Item>
          <StandardArray formData={formData} updateFormData={updateFormData} />
        </Grid.Item>
      )}
      <Grid.Item>
        <Grid>
          {formData.abilities?.scores?.map((score, index) => {
            const ability = system.abilities.find((ability) => ability.id === score.ability)
            return (
              <Grid.Item key={index} colSpan={{ sm: 12, md: 4 }}>
                <AbilityCard key={index} score={score} ability={ability} />
              </Grid.Item>
            )
          })}
        </Grid>
      </Grid.Item>
    </Grid>
  )
}

export default AbilitiesForm
