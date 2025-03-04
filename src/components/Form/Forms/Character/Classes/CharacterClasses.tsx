import CharacterClass from '../../../Subforms/Character/Class/CharacterClass'
import ClassSelection from '../../../Subforms/Character/Class/ClassSelection'
import { Character } from '../../../../../../amplify/gql/types'
import { useListClassesQuery } from '../../../../../features/classes/classesApi'
import { UpdateState } from '../../../../../types/form'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import Grid from '../../../../Grid/Grid'

const CharacterClasses = () => {
  const { addClass, formData, updateFormData } = use(FormContext) as {
    addClass: boolean
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }
  const { data: classes } = useListClassesQuery()

  const handleRemoveClass = ({ classIndex }: { classIndex: number }) => {
    const updatedClasses = formData.classes.filter((_, index) => classIndex !== index)

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
      {formData.classes?.length > 0 && !addClass ? (
        formData.classes?.map((uClass, cIndex) => {
          const fullClass = classes?.find((classItem) => uClass.id === classItem.id)
          return (
            <CharacterClass
              uClass={uClass}
              fullClass={fullClass}
              classIndex={cIndex}
              key={cIndex}
              handleRemoveClass={() => handleRemoveClass({ classIndex: cIndex })}
              updateFormData={updateFormData}
              formData={formData}
            />
          )
        })
      ) : (
        <ClassSelection />
      )}
    </Grid>
  )
}

export default CharacterClasses
