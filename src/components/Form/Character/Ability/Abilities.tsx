import { useMemo } from 'react'
import { ability_card_group, system_select } from '../Character.css'
import Dropdown from '../../../Dropdown/Dropdown'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import Row from '../../../Row/Row'
import Scene from '../../../Dice/Scene'
import { createPortal } from 'react-dom'
import { AbilityGenerate } from '../../../../types/enums'
import { Character } from '../../../../../amplify/gql/types'
import PointBuy from './PointBuy'
import StandardArray from './StandardArray'
import ManualArray from './ManualArray'
import { UpdateState } from '../../../../types/form'
import { use } from 'react'
import { FormContext } from '../../FormContext'
import AbilityCard from './AbilityCard'

const AbilitiesForm = () => {
  const { data: system } = useGetSystemQuery()

  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (formData: UpdateState<Character>) => void
  }

  const form: HTMLFormElement = document.getElementById('form_content') as HTMLFormElement

  const pointSystem = useMemo(() => formData.abilities?.selectedSystem, [formData.abilities?.selectedSystem])

  return (
    <>
      {form && createPortal(<Scene />, form)}
      <Dropdown
        name='abilities.selectedSystem'
        options={system.rules.abilityGenerateMethod}
        className={system_select}
        label='Point System'
        value={formData.abilities?.selectedSystem}
        onChange={updateFormData}
      />
      {pointSystem === AbilityGenerate.pointBuy && <PointBuy formData={formData} updateFormData={updateFormData} />}
      {pointSystem === AbilityGenerate.manual && <ManualArray formData={formData} updateFormData={updateFormData} />}
      {pointSystem === AbilityGenerate.standardArray && (
        <StandardArray formData={formData} updateFormData={updateFormData} />
      )}
      <Row cols={{ md: 3, base: 1 }} spacing='spaceBetween' className={ability_card_group}>
        {formData.abilities?.scores?.map((score, index) => {
          const ability = system.abilities.find((ability) => ability.id === score.ability)
          return <AbilityCard key={index} score={score} ability={ability} />
        })}
      </Row>
    </>
  )
}

export default AbilitiesForm
