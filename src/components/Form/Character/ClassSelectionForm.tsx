import Spinner from '../../Spinner/Spinner'
import { useContext, useEffect } from 'react'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { useLocation, useNavigate } from 'react-router-dom'
import { selectAllClasses, useGetClassesQuery } from '../../../features/class/classApiSlice'
import { card_group, card_header_title, main_card } from './Character.css'
import { form_content } from '../Form.css'
import clsx from 'clsx'
import ClassFeatureForm from './ClassFeatureForm'
import { FormStepsContext } from '../FormStepsContext'

const ClassSelectionFormTest = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { selectedClass, setSelectedClass, addClass, setAddClass } = useContext(FormStepsContext)

  const classSelected = location.state?.selected
  const formClass = location.state?.selection?.item
  const creationContext = location.state?.selection?.context

  const { classes } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  useEffect(() => {
    if (
      classSelected &&
      (!(selectedClass?.length > 0) || (!selectedClass.includes(formClass as never) && addClass)) &&
      creationContext === 'class'
    ) {
      const classArray: any[] = selectedClass?.length > 0 ? [...selectedClass] : []
      classArray.push(formClass)
      setSelectedClass(classArray)
      setAddClass(false)
    }
  }, [classSelected, selectedClass, setSelectedClass, creationContext, addClass, setAddClass, formClass])

  const handleShowDetail = (item: any, context: string) => {
    navigate(`/${context}/${item.name}/short`, {
      state: {
        background: location,
        item: item,
        size: 'sm',
        context: context,
      },
    })
  }

  const baseClasses = classes?.filter((uClass: any) => uClass.category.name === 'base') as any[]

  return !baseClasses ? (
    <Spinner />
  ) : selectedClass?.length > 0 && !addClass ? (
    <ClassFeatureForm />
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

export default ClassSelectionFormTest
