import parse from 'html-react-parser'
import { Fragment, useEffect, useRef, useState } from 'react'
import { selectClassById, useGetClassesQuery } from './classesApiSlice'
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import Spinner from '../../components/Spinner'

const Class = () => {
  const [activeSection, setActiveSection] = useState()
  const sidebarRef = useRef()
  const sidebarBtnRef = useRef()
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

  const onEditClicked = () => {
    navigate(`${location.state.background.pathname}/edit/${userClass.name}`, {
      state: { data: id, previous: location },
    })
  }

  useEffect(() => {
    const sidebar = sidebarRef.current
    const button = sidebarBtnRef.current

    button.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed')
    })

    return () =>
      button.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed')
      })
  }, [])

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

  if (isFetching) {
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
                      {detailItem.value}
                    </a>
                  </li>
                ))}
              {userClass.subclass && (
                <li
                  className={`sidebar-item ${
                    activeSection === userClass.subclass.name ? 'active' : ''
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
              {/* {subclass.length > 0 &&
                subclass.map((subclassItem, subclassIndex) => (
                  <li
                    key={subclassItem}
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
                ))} */}
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
                ref={sidebarBtnRef}
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
            <em id='title'>{userClass?.desc && parse(userClass.desc)}</em>
            {userClass?.details?.length > 0 &&
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
                        featureItem.attribute?.some(
                          (attributeItem) =>
                            attributeItem.name === 'explicitlyShown'
                        ) && (
                          <Fragment key={featureIndex}>
                            <strong>{featureItem.value}</strong>
                            {featureItem.desc && parse(featureItem.desc)}
                          </Fragment>
                        )
                    )}
                </section>
              ))}
            {userClass.subclass?.name && (
              <section id={`${userClass.subclass.name}`}>
                <h3>{userClass.subclass.value}</h3>
                <hr />
                {userClass.subclass.desc && parse(userClass.subclass.desc)}
              </section>
            )}
            {/* {subclass.length > 0 && (
              <>
                {subclass.map((subclassItem, subClassIndex) => (
                  <section id={`${subclassItem.name}`} key={subClassIndex}>
                    <h4>{subclassItem.value}</h4>
                    {subclassItem.desc && parse(subclassItem.desc)}
                    {subclassItem.feature?.length > 0 &&
                      subclassItem.feature.map(
                        (featureItem, featureIndex) =>
                          featureItem.attribute?.some(
                            (attributeItem) =>
                              attributeItem.name === 'explicitlyShown'
                          ) && (
                            <Fragment key={featureIndex}>
                              <strong>{featureItem.value}</strong>
                              {featureItem.desc && parse(featureItem.desc)}
                            </Fragment>
                          )
                      )}
                    {subClassIndex !== subclass.length - 1 && <hr />}
                  </section>
                ))}
              </>
            )} */}
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
