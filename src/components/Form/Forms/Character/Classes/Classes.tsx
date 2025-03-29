import CharacterClass from '../../../Subforms/Character/Class/CharacterClass'
import ClassSelection from '../../../Subforms/Character/Class/ClassSelection'
import { Character } from '../../../../../../amplify/gql/types'
import { UpdateState } from '../../../../../types/form'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import Grid from '../../../../Grid/Grid'

const Classes = () => {
  const { addClass, formData, updateFormData } = use(FormContext) as {
    addClass: boolean
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const handleRemoveClass = ({ classIndex }: { classIndex: number }) => {
    const updatedClasses = formData.classes?.filter((_, index) => classIndex !== index)

    if (formData.classes?.length === 1) {
      updateFormData({
        type: 'remove',
        path: `classes`,
      })
    } else {
      updateFormData({
        type: 'update',
        path: `classes`,
        value: updatedClasses,
      })
    }
  }

  return (
    <Grid>
      {formData.classes?.length && !addClass ?
        formData.classes?.map((uClass, cIndex) => {
          return (
            <CharacterClass
              uClass={uClass}
              classIndex={cIndex}
              key={cIndex}
              handleRemoveClass={() => handleRemoveClass({ classIndex: cIndex })}
            />
          )
        })
      : <ClassSelection />}
    </Grid>
  )
}

export default Classes
