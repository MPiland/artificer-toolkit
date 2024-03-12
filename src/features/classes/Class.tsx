import parse from 'html-react-parser'
import { Fragment } from 'react'
import {
  selectClassById,
  selectSubclassById,
  useGetClassesQuery,
} from './classesApiSlice'
import { useLocation } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
import { useSelector } from 'react-redux'
import Detail from '../../components/Detail/Detail'

const Class = () => {
  const location: any = useLocation()

  const {
    userClass,
    isFetching,
    isLoading,
  }: { userClass: any; isFetching: boolean; isLoading: boolean } =
    useGetClassesQuery(undefined, {
      selectFromResult: ({ data, isFetching, isLoading }) => ({
        userClass: data && selectClassById(data, location.state.data.id),
        isFetching,
        isLoading,
      }),
    })

  const subclass: any = useSelector((state) =>
    selectSubclassById(state, location.state.data.id)
  )

  const scrollToElement = (e: MouseEvent, id: string) => {
    const element = document.getElementById(`${id}`)
    e.preventDefault()
    element &&
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
  }

  let content

  if (isFetching || isLoading || !userClass) {
    return (content = <Spinner />)
  }

  const detail = (
    <>
      <div id='quote'>
        <em>{userClass.desc && parse(userClass.desc)}</em>
      </div>
      {userClass.category?.name === 'base' ? (
        <>
          {userClass.detail &&
            userClass.detail?.length > 0 &&
            userClass.detail.map((detailItem: any, detailIndex: number) => (
              <section id={`${detailItem.name}`} key={detailIndex}>
                <strong>
                  <h2>{detailItem.value}</h2>
                </strong>
                <hr />
                {detailItem.desc && parse(detailItem.desc)}
                {detailIndex === userClass.detail.length - 1 &&
                  userClass.feature?.length > 0 &&
                  userClass.feature.map(
                    (featureItem: any, featureIndex: number) => (
                      <Fragment key={featureIndex}>
                        <h3>
                          <strong>
                            {featureItem.value}
                          </strong>
                        </h3>
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
              {subclass.map((subclassItem: any, subClassIndex: number) => {
                return (
                  <section id={`${subclassItem.name}`} key={subClassIndex}>
                    <h2>
                      <strong>{subclassItem.value}</strong>
                    </h2>
                    <hr />
                    {subclassItem.desc && parse(subclassItem.desc)}
                    {subclassItem.feature?.length > 0 &&
                      subclassItem.feature.map(
                        (featureItem: any, featureIndex: number) => {
                          return (
                            <Fragment key={featureIndex}>
                              <h3>
                                <strong>
                                  {featureItem.value}
                                </strong>
                              </h3>
                              {featureItem.desc && parse(featureItem.desc)}
                            </Fragment>
                          )
                        }
                      )}
                    {subClassIndex !== subclass.length - 1 && <hr />}
                  </section>
                )
              })}
            </>
          )}
        </>
      ) : (
        <>
          {userClass.feature?.length > 0 &&
            userClass.feature.map((featureItem: any, featureIndex: number) => (
              <section
                id={`${featureItem.name}`}
                key={featureIndex}
                className='pb-4'
              >
                <h3>
                  <strong>
                    {featureItem.value}
                  </strong>
                </h3>
                {featureItem.desc && parse(featureItem.desc)}
              </section>
            ))}
        </>
      )}
    </>
  )

  const sidebarList =
    userClass?.category?.name === 'base' ? (
      <>
        {userClass?.detail?.length > 0 &&
          userClass.detail.map((detailItem: any, detailIndex: number) => (
            <li
              key={detailIndex}
              onClick={(e: any) => {
                scrollToElement(e, detailItem.name)
              }}
            >
              <a href='/'>{detailItem?.value}</a>
            </li>
          ))}
        {userClass.subclass && (
          <li
            onClick={(e: any) => {
              scrollToElement(e, userClass.subclass.name)
            }}
          >
            <a href='/'>{userClass.subclass.value}</a>
          </li>
        )}
        {subclass.length > 0 &&
          subclass.map((subclassItem: any, subclassIndex: number) => (
            <li key={subclassIndex}>
              <a
                href='/'
                onClick={(e: any) => {
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
          userClass.feature.map((featureItem: any, featureIndex: number) => (
            <li key={featureIndex}>
              <a
                href='/'
                className='sidebar-link'
                onClick={(e: any) => {
                  scrollToElement(e, featureItem.name)
                }}
              >
                {featureItem.value}
              </a>
            </li>
          ))}
      </>
    )

  content = (
    <Detail
      detail={detail}
      sidebar={{ list: sidebarList }}
      location={location}
      footerSpacing='end'
    />
  )

  return content
}

export default Class
