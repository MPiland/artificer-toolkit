import { FC, useState, useRef, ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Grid from '../Grid/Grid'
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

  const [sidebarIsOpen, setSidebarIsOpen] = useState<boolean>(false)

  const form = location.state.form
  const item = location.state.item

  const sidebarRef = useRef<HTMLDivElement>(null)
  const sidebarListRef = useRef<HTMLUListElement>(null)
  const hamburgerRef = useRef<HTMLDivElement>(null)

  const handleEdit = () => {
    navigate(`/${form}/edit/${item.name}`, {
      state: {
        item: item,
        formType: 'edit',
        form: form,
      },
    })
  }

  const handleScroll = () => {
    const scrollBody = document.getElementById('detailBody')
    const sections = document.querySelectorAll('section')
    const listItems = sidebarListRef.current?.children
    const filteredListItems = listItems && Array.from(listItems).slice(1)

    if (scrollBody)
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
          if (filteredListItems && !filteredListItems[sectionIndex].classList.contains('active')) {
            filteredListItems[sectionIndex].classList.add('active')
          }
        }
        if (!isActive) {
          if (section.classList.contains('active')) {
            section.classList.remove('active')
          }
          if (filteredListItems && filteredListItems[sectionIndex].classList.contains('active')) {
            filteredListItems[sectionIndex].classList.remove('active')
          }
        }
      })
  }

  return (
    <>
      <Modal.Header title={item.value}>
        {sidebar && (
          <>
            <Hamburger
              onClick={() => setSidebarIsOpen((prev) => !prev)}
              isActive={sidebarIsOpen}
              hamburgerRef={hamburgerRef}
            />
          </>
        )}
      </Modal.Header>
      <Modal.Body>
        {colsData && cols && (
          <>
            <Grid cols={{ lg: 4, md: 3, base: 2 }} className={sprinkles({ mb: 'size-2' })}>
              {cols?.map((colItem, colIndex) => {
                return (
                  <div key={colIndex}>
                    <div className={detail_title}>{colItem.header}</div>
                    <div>{getValueFromState(colItem, colsData, colItem?.truncate)}</div>
                  </div>
                )
              })}
            </Grid>
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
      </Modal.Body>
      <Modal.Footer>
        <Group justifyContentVariant={footerSpacing} directionVariant='row' alignItemsVariant='end'>
          {footer}
          <Button onClick={handleEdit} variant='primary_outline'>
            Edit
          </Button>
        </Group>
      </Modal.Footer>
    </>
  )
}

export default Detail
