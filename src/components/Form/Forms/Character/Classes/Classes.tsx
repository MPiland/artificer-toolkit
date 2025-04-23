import CharacterClass from '../../../Subforms/Character/Class/CharacterClass'
import ClassSelection from '../../../Subforms/Character/Class/ClassSelection'
import { Character } from '../../../../../../amplify/gql/types'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import Grid from '../../../../Grid/Grid'
import { OnChange } from '../../../../../types/types'

const Classes = () => {
  const {
    addClass,
    formStore: { data, updateField, removeField },
  } = use(FormContext) as {
    addClass: boolean
    formStore: {
      data: Character
      updateField: OnChange<Character>['updateField']
      removeField: OnChange<Character>['removeField']
    }
  }

  const handleRemoveClass = ({ classIndex }: { classIndex: number }) => {
    const updatedClasses = data.classes?.filter((_, index) => classIndex !== index)

    if (data.classes?.length === 1) {
      removeField({ path: `classes` })
    } else {
      updateField({ path: `classes`, value: updatedClasses })
    }
  }

  return (
    <Grid>
      {data.classes?.length && !addClass ?
        data.classes?.map((uClass, cIndex) => {
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
