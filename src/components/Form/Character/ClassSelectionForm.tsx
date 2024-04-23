import Spinner from '../../Spinner/Spinner'
import { ReducerActionType, FormContext } from '../../../utils/types'
import { Fragment } from 'react'
import Collapse from '../../Collapse/Collapse'
import parse from 'html-react-parser'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { sprinkles } from '../../../css/sprinkles.css'
import { useLocation, useNavigate } from 'react-router-dom'
import { selectAllClasses, useGetClassesQuery } from '../../../features/class/classApiSlice'
import { card_group, card_header_title, main_card } from './Character.css'
import { form_content } from '../Form.css'
import clsx from 'clsx'

interface ClassSelectionFormProps {
  context: FormContext
  formState: any
  setFormState: (arg: ReducerActionType) => void
  selectedClass: any
  setSelectedClass: (arg: any) => void
  addClass: boolean
  setAddClass: (arg: boolean) => void
  handleShowDetail: (arg1: any, arg2: string) => void
}

const ClassSelectionForm = ({
  formState,
  setFormState,
  selectedClass,
  setSelectedClass,
  addClass,
  setAddClass,
  handleShowDetail,
}: ClassSelectionFormProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  const { classes } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  const baseClasses = classes?.filter((uClass: any) => uClass.category.name === 'base') as any[]

  return !baseClasses ? (
    <Spinner />
  ) : (
    (!(selectedClass?.length > 0) || addClass === true) && (
      <ScrollArea scrollDirection='vertical' className={form_content}>
        {baseClasses.map((uClass: any, index: number) => {
          return (
            <div className={card_group} key={index}>
              <div className={clsx(main_card, 'clickable')} onClick={() => handleShowDetail(uClass, 'class')}>
                <h3 className={card_header_title}>{uClass.value}</h3>
              </div>
            </div>
          )
        })}
      </ScrollArea>
    )
  )
}

export default ClassSelectionForm
