import { FC, useState, useRef, ReactNode, use } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Row from '../Row/Row'
import { getValueFromState } from '../../utils/formatting'
import Button from '../Button/Button'
import Group from '../Group/Group'
import {
  detail_aside,
  detail_aside_list,
  detail_aside_title,
  detail_body,
  detail_main,
  detail_title,
} from './Detail.css'
import { Hamburger } from '../../components/AppShell/AppShell'
import Modal from '../Modal/Modal'
import clsx from 'clsx'
import { sprinkles } from '../../css/sprinkles.css'
import ScrollArea from '../ScrollArea/ScrollArea'
import FormContext from '../Form/FormContext'

type colType = {
  header: string
  name: string | any[]
  truncate?: number
  filter?: undefined | string[]
}

interface DetailProps {
  cols?: colType[]
  colsData?: any
  children: ReactNode
  footer?: any
  footerSpacing?: 'spaceBetween' | 'center' | 'end' | 'start' | undefined
  sidebar?: any
}

const Detail: FC<DetailProps> = ({ cols, colsData, children, footer, footerSpacing = 'spaceBetween', sidebar }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const { setContext, updateFormData, setStepIndex, stateReset } = use(FormContext)

  const [sidebarIsOpen, setSidebarIsOpen] = useState<boolean>(false)

  const form = location.state.form
  const item = location.state.item

  const sidebarRef = useRef<HTMLDivElement>(null)
  const sidebarListRef = useRef<HTMLUListElement>(null)

  const handleEdit = async () => {
    const title = form
    try {
      await stateReset()
    } catch {
      console.log('error resetting state')
    } finally {
      setStepIndex(0)
      setContext({ title: title, type: 'edit' as string })
      updateFormData({ type: 'reset', value: item })
      updateFormData({ type: 'initialReset', value: item })
      navigate(`/${form}/edit/${item.name}`, {
        state: {
          previous: location,
        },
      })
    }
  }

  const handleScroll = () => {
    const scrollBody = document.getElementById('detailBody')
    const sections = document.querySelectorAll('section')
    const listItems = sidebarListRef.current?.children
    const filteredListItems = listItems && Array.from(listItems).slice(1)

    if (scrollBody) {
      sections.forEach((section, sectionIndex) => {
        const sectionRect = section.getBoundingClientRect()
        const scrollTop = scrollBody?.getBoundingClientRect()

        let closestSection: HTMLElement | null = null

        // Adjust the range to determine if the section is active
        const isActive = scrollTop && scrollTop.top >= sectionRect.top - 50 && scrollTop.top <= sectionRect.bottom - 50

        if (isActive) {
          // Update the closest section if the current one is closer to the top
          if (
            closestSection === null ||
            (closestSection &&
              Math.abs(sectionRect.top - scrollTop.top) <
                Math.abs((closestSection as HTMLElement).getBoundingClientRect().top - scrollTop.top))
          ) {
            closestSection = section
          }
        }

        if (isActive) {
          if (!section.classList.contains('active')) {
            section.classList.add('active')
          }
          if (filteredListItems && !filteredListItems[sectionIndex]?.classList?.contains('active')) {
            filteredListItems[sectionIndex]?.classList?.add('active')
          }
        }
        if (!isActive) {
          if (section.classList.contains('active')) {
            section.classList.remove('active')
          }
          if (filteredListItems && filteredListItems[sectionIndex]?.classList?.contains('active')) {
            filteredListItems[sectionIndex]?.classList?.remove('active')
          }
        }
      })
    }
  }

  return (
    <Modal>
      <Modal.Dialogue>
        <Modal.Header title={item.value}>
          {sidebar && (
            <>
              <Hamburger collapsed={!sidebarIsOpen} onClick={() => setSidebarIsOpen((prev) => !prev)} />
            </>
          )}
        </Modal.Header>
        <Modal.Content>
          {colsData && cols && (
            <>
              <Row cols={{ lg: 4, md: 3, base: 2 }} className={sprinkles({ mb: 'space-2' })}>
                {cols?.map((colItem, colIndex) => {
                  return (
                    <div key={colIndex}>
                      <div className={detail_title}>{colItem.header}</div>
                      <div>
                        {getValueFromState({ input: colItem, state: colsData, truncateNum: colItem?.truncate })}
                      </div>
                    </div>
                  )
                })}
              </Row>
              <hr />
            </>
          )}
          <div className={clsx(detail_main, { ['active']: sidebarIsOpen })}>
            {sidebar && (
              <aside className={clsx({ ['active']: sidebarIsOpen }, detail_aside)} ref={sidebarRef}>
                <ul className={detail_aside_list} ref={sidebarListRef}>
                  <p className={detail_aside_title}>NAVIGATION</p>
                  {sidebar.list}
                </ul>
              </aside>
            )}
            <ScrollArea
              scrollDirection='vertical'
              wrapperClassName={detail_body}
              onScroll={() => sidebar && handleScroll()}
              id='detailBody'
            >
              {children}
            </ScrollArea>
          </div>
        </Modal.Content>
        <Modal.Footer>
          <Group justifyContentVariant={footerSpacing} directionVariant='row' alignItemsVariant='end'>
            {footer}
            <Button onClick={handleEdit} style='outline'>
              Edit
            </Button>
          </Group>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )
}

export default Detail
