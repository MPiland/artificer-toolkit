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
import { sprinkles } from '../../css/sprinkles.css'

const Class = () => {
  const location: any = useLocation()

  const handlePreReq = (parentItem: any, childItem: any) => {
    const parentLevel = parentItem.levelAvailable
    const childLevel = childItem.levelAvailable
    const childReq = childItem.attribute?.some(
      (attributeItem: any) => attributeItem.name === 'hasRequirements'
    )
    const childReqsText = []

    if (childLevel !== parentLevel) {
      childReqsText.push(`Class level ${childLevel}`)
    }

    if (childReq) {
      const childReqOption = childItem.requirement
      if (childReqOption && childReqOption.option?.length > 0) {
        if (
          childReqOption.skillProficiency &&
          childReqOption.skillProficiency?.skill?.length > 0
        ) {
          childReqsText.push(
            `Skill(s) Proficiency: ${childReqOption.skillProficiency?.skill.map(
              (skillItem: any, skillIndex: number) => {
                const skillName = skillItem.value
                if (
                  childReqOption.skillProficiency?.skill?.length > 1 &&
                  skillIndex !==
                    childReqOption.skillProficiency?.skill?.length - 1
                ) {
                  return `${skillName}, `
                } else {
                  return `${skillName}`
                }
              }
            )}`
          )
        }
        if (
          childReqOption.abilityScore &&
          childReqOption.abilityScore?.ability?.length > 0
        ) {
          childReqsText.push(
            `Ability Score: ${childReqOption.abilityScore?.ability.map(
              (abilityItem: any, abilityIndex: number) => {
                const abilityName = abilityItem.value
                if (
                  childReqOption.abilityScore?.ability?.length > 1 &&
                  abilityIndex !==
                    childReqOption.abilityScore?.ability?.length - 1
                ) {
                  return `(${childReqOption.abilityScore?.score}) ${abilityName}, `
                } else {
                  return `(${childReqOption.abilityScore?.score}) ${abilityName}`
                }
              }
            )}`
          )
        }
        if (
          childReqOption.spellKnown &&
          childReqOption.spellKnown?.spell?.length > 0
        ) {
          childReqsText.push(
            `Spell(s) Known: ${childReqOption.spellKnown?.spell.map(
              (spellItem: any, spellIndex: number) => {
                const spellName = spellItem.value
                if (
                  childReqOption.abilityScore?.ability?.length > 1 &&
                  spellIndex !==
                    childReqOption.abilityScore?.ability?.length - 1
                ) {
                  return `${spellName}, `
                } else {
                  return `${spellName}`
                }
              }
            )}`
          )
        }
        if (
          childReqOption.featureKnown &&
          childReqOption.featureKnown?.feature?.length > 0
        ) {
          let featureText = ''
          childReqOption.featureKnown?.feature?.map(
            (reqFeatureItem: any, reqFeatureIndex: number) => {
              featureText += `${reqFeatureItem.value}`
              const featureLength = childReqOption.featureKnown?.feature.length
              const classFeature = userClass.feature.find(
                (classFeatureItem: any) =>
                  reqFeatureItem._id === classFeatureItem._id
              )
              if (childReqOption.featureKnown?.option?.length > 0) {
                childReqOption.featureKnown?.option?.map(
                  (reqOptionItem: any, reqOptionIndex: any) => {
                    const optionLength =
                      childReqOption.featureKnown?.option?.length
                    const classFeatureOption = classFeature.option?.find(
                      (classFeatureOptionItem: any) =>
                        classFeatureOptionItem._id === reqOptionItem._id
                    )
                    if (classFeatureOption) {
                      if (
                        featureLength > 1 &&
                        reqOptionIndex !== optionLength - 1
                      ) {
                        featureText += `: ${reqOptionItem.value}, `
                      } else {
                        featureText += `: ${reqOptionItem.value}`
                      }
                    }
                  }
                )
              } else {
                if (
                  featureLength > 1 &&
                  reqFeatureIndex !== featureLength - 1
                ) {
                  featureText += '; '
                }
              }
            }
          )
          childReqsText.push(featureText)
        }
      }
    }
    if (childReqsText?.length > 0) {
      console.log({ childReqsText: childReqsText })
      let reqText = 'Prerequisite(s) - '
      childReqsText.map((reqItem: any, reqIndex: number) => {
        if (childReqsText.length > 1 && reqIndex !== childReqsText.length - 1) {
          reqText += `${reqItem} / `
        } else {
          reqText += `${reqItem}`
        }
      })
      return reqText
    } else {
      return null
    }
  }

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
                          <strong>{featureItem.value}</strong>
                        </h3>
                        {featureItem.desc && parse(featureItem.desc)}
                        {featureItem.option?.length > 0 &&
                          featureItem.option.map(
                            (optionItem: any, optionIndex: number) => (
                              <Fragment key={optionIndex}>
                                <h4>
                                  <strong>{optionItem.value}</strong>
                                </h4>
                                {handlePreReq(featureItem, optionItem) && (
                                  <p>
                                    <em className={sprinkles({ mb: 'size-3' })}>
                                      <u>
                                        {handlePreReq(featureItem, optionItem)}
                                      </u>
                                    </em>
                                  </p>
                                )}
                                {optionItem.desc && parse(optionItem.desc)}
                              </Fragment>
                            )
                          )}
                      </Fragment>
                    )
                  )}
              </section>
            ))}
          {userClass.subclass && userClass.subclass?.name && (
            <section id={`${userClass.subclass.name}`}>
              <h2>
                <strong>{userClass.subclass.value}</strong>
              </h2>
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
                                <strong>{featureItem.value}</strong>
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
                  <strong>{featureItem.value}</strong>
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

  return isFetching || isLoading || !userClass ? (
    <Spinner />
  ) : (
    <Detail
      detail={detail}
      sidebar={{ list: sidebarList }}
      location={location}
      footerSpacing='end'
    />
  )
}

export default Class
