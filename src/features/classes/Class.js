import parse from 'html-react-parser'
import { Fragment, useRef, useState } from 'react'
import {
  selectClassById,
  selectSubclassById,
  useGetClassesQuery,
} from './classesApiSlice'
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import { useSelector } from 'react-redux'
import { selectLoadingStatus } from '../../app/loadingSlice'

const Class = () => {
  const [activeSection, setActiveSection] = useState()
  const sidebarRef = useRef()
  const sidebarListRef = useRef()
  const modalBodyRef = useRef()

  const location = useLocation()
  const navigate = useNavigate()
  const { data: id, handleClose } = useOutletContext()

  const { userClass, isFetching } = useGetClassesQuery('classesList', {
    selectFromResult: ({ data }) => ({
      userClass: data && selectClassById(data, id),
    }),
  })

  const subclass = useSelector((state) => selectSubclassById(state, id))

  const isLoading = useSelector(selectLoadingStatus)

  const onEditClicked = () => {
    navigate(`${location.state.background.pathname}/edit/${userClass.name}`, {
      state: { data: id, previous: location },
    })
  }

  const onSideBarClicked = () => {
    const sidebar = sidebarRef.current

    sidebar.classList.toggle('collapsed')
  }

  const handleScroll = () => {
    const modalBody = modalBodyRef.current
    const sections = document.querySelectorAll('section')

    sections.forEach((section) => {
      const sectionTop = section.offsetTop
      const sectionHeight = section.offsetHeight
      const sectionBottom = sectionTop + sectionHeight
      const scrollTop = modalBody.scrollTop

      // Adjust the range to determine if the section is active
      const isActive =
        scrollTop >= sectionTop - 50 && scrollTop < sectionBottom - 25

      if (isActive) {
        setActiveSection(section.id)
      }
    })
  }

  const scrollToElement = (e, id) => {
    const element = document.getElementById(`${id}`)
    e.preventDefault()
    element &&
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
  }

  let content

  if (isFetching || isLoading) {
    return (content = <Spinner />)
  }

  content = (
    <>
      <div className='modal-wrapper'>
        <aside
          className='modal-sidebar collapsed'
          id='class-sidebar'
          ref={sidebarRef}
        >
          <div>
            <ul className='sidebar-nav' ref={sidebarListRef}>
              <li className='sidebar-header'>NAVIGATION</li>
              {userClass?.category?.name === 'base' ? (
                <>
                  {userClass?.details?.length > 0 &&
                    userClass.details.map((detailItem, detailIndex) => (
                      <li
                        className={`sidebar-item ${
                          activeSection === detailItem.name ? 'active' : ''
                        }`}
                        key={detailIndex}
                      >
                        <a
                          href='/'
                          onClick={(e) => {
                            scrollToElement(e, detailItem.name)
                          }}
                          className='sidebar-link'
                        >
                          {detailItem?.value}
                        </a>
                      </li>
                    ))}
                  {userClass.subclass && (
                    <li
                      className={`sidebar-item ${
                        activeSection === userClass.subclass.name
                          ? 'active'
                          : ''
                      }`}
                    >
                      <a
                        href='/'
                        className='sidebar-link'
                        onClick={(e) => {
                          scrollToElement(e, userClass.subclass.name)
                        }}
                      >
                        {userClass.subclass.value}
                      </a>
                    </li>
                  )}
                  {subclass.length > 0 &&
                    subclass.map((subclassItem, subclassIndex) => (
                      <li
                        key={subclassIndex}
                        className={`sidebar-item ${
                          activeSection === subclassItem.name ? 'active' : ''
                        }`}
                      >
                        <a
                          href='/'
                          className='sidebar-link'
                          onClick={(e) => {
                            scrollToElement(e, subclassItem.name)
                          }}
                        >
                          {subclassItem.value}
                        </a>
                      </li>
                    ))}
                </>
              ) : (
                <>
                  {userClass.feature?.length > 0 &&
                    userClass.feature.map(
                      (featureItem, featureIndex) =>
                        !featureItem.attribute?.some(
                          (attributeItem) =>
                            attributeItem.name === 'hideInBuilder'
                        ) && (
                          <li
                            className={`sidebar-item ${
                              activeSection === featureItem.name ? 'active' : ''
                            }`}
                            key={featureIndex}
                          >
                            <a
                              href='/'
                              className='sidebar-link'
                              onClick={(e) => {
                                scrollToElement(e, featureItem.name)
                              }}
                            >
                              {featureItem.value}
                            </a>
                          </li>
                        )
                    )}
                </>
              )}
            </ul>
          </div>
        </aside>
        <div className='modal-main'>
          <div className='modal-header'>
            <nav className='navbar navbar-expand px-3'>
              <button
                className='btn'
                id='className-sidebar-btn'
                type='button'
                onClick={onSideBarClicked}
              >
                <span className='navbar-toggler-icon'></span>
              </button>
            </nav>
            <h1 className='fw-bold mb-0 fs-2 ms-auto'>{userClass.value}</h1>
            <button
              type='button'
              className='btn-close'
              aria-label='Close'
              onClick={handleClose}
            ></button>
          </div>
          <div
            className='modal-body detail-card'
            onScroll={(e) => handleScroll(e)}
            ref={modalBodyRef}
          >
            <em id='title'>{userClass.desc && parse(userClass.desc)}</em>
            {userClass.category?.name === 'base' ? (
              <>
                {userClass.details &&
                  userClass.details?.length > 0 &&
                  userClass.details.map((detailItem, detailIndex) => (
                    <section id={`${detailItem.name}`} key={detailIndex}>
                      <h3>
                        <strong>{detailItem.value}</strong>
                      </h3>
                      <hr />
                      {detailItem.desc && parse(detailItem.desc)}
                      {detailIndex === userClass.details.length - 1 &&
                        userClass.feature?.length > 0 &&
                        userClass.feature.map(
                          (featureItem, featureIndex) =>
                            (!featureItem?.attribute ||
                              !featureItem?.attribute?.some(
                                (attributeItem) =>
                                  attributeItem.name === 'hideInBuilder'
                              )) && (
                              <Fragment key={featureIndex}>
                                <h4>
                                  <strong>{featureItem.value}</strong>
                                </h4>
                                {featureItem.desc && parse(featureItem.desc)}
                              </Fragment>
                            )
                        )}
                    </section>
                  ))}
                {userClass.subclass && userClass.subclass?.name && (
                  <section id={`${userClass.subclass.name}`}>
                    <h3>
                      <strong>{userClass.subclass.value}</strong>
                    </h3>
                    <hr />
                    {userClass.subclass?.desc && parse(userClass.subclass.desc)}
                  </section>
                )}
                {subclass.length > 0 && (
                  <>
                    {subclass.map((subclassItem, subClassIndex) => (
                      <section id={`${subclassItem.name}`} key={subClassIndex}>
                        <h4>
                          <strong>{subclassItem.value}</strong>
                        </h4>
                        {subclassItem.desc && parse(subclassItem.desc)}
                        {userClass.feature?.length > 0 &&
                          userClass.feature.map(
                            (featureItem, featureIndex) =>
                              (!featureItem?.attribute ||
                                featureItem?.attribute?.some(
                                  (attributeItem) =>
                                    attributeItem.name !== 'hideInBuilder'
                                )) && (
                                <Fragment key={featureIndex}>
                                  <h4>
                                    <strong>{featureItem.value}</strong>
                                  </h4>
                                  {featureItem.desc && parse(featureItem.desc)}
                                </Fragment>
                              )
                          )}
                        {subClassIndex !== subclass.length - 1 && <hr />}
                      </section>
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                {userClass.feature.length > 0 &&
                  userClass.feature.map(
                    (featureItem, featureIndex) =>
                      (!featureItem?.attribute ||
                        featureItem?.attribute?.some(
                          (attributeItem) =>
                            attributeItem.name !== 'hideInBuilder'
                        )) && (
                        <section
                          id={`${featureItem.name}`}
                          key={featureIndex}
                          className='pb-4'
                        >
                          <h5>
                            <strong>{featureItem.value}</strong>
                          </h5>
                          <hr />
                          {featureItem.desc && parse(featureItem.desc)}
                        </section>
                      )
                  )}
              </>
            )}
          </div>
          <div className='modal-footer'>
            <button
              className='btn btn-outline-secondary btn-small'
              onClick={onEditClicked}
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    </>
  )

  return content
}

export default Class
