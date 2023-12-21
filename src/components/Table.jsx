import { useEffect, useState, Fragment, memo } from 'react'
import useSortableData from '../hooks/useSortableData'
import { getValueFromState } from '../helpers/formatting'
import useMediaQuery from '../hooks/useMediaQuery'
import { get } from 'lodash'
import Input from './Input'
import Select from './Select'
import Spinner from './Spinner'

const TableHeader = ({
  rows,
  sortable,
  requestSort,
  getClassNames,
  readOnly,
  scrollable,
  className,
}) => {
  return (
    <div
      className={`row pb-2 gx-2 justify-content-start ${
        className ? className : ''
      } mx-0 gx-0 align-items-end ${scrollable ? ' scrollable' : ''}`}
    >
      {rows?.collapse && <div className='col-1'></div>}
      {rows?.headers?.map((headerItem, headerIndex) => (
        <Fragment key={headerIndex}>
          {!headerItem.breakpoint &&
            (readOnly || headerItem.readOnly ? (
              <div
                className={`${headerItem.size ?? ''} ${
                  headerItem.className ?? ''
                } ${sortable ? 'sortable' : ''} ${getClassNames(
                  headerItem.name?.sortOn ?? headerItem.name
                )} ${headerItem.required ? 'required' : ''} header text-start`}
                onClick={() => sortable && requestSort(headerItem.name)}
              >
                {headerItem.value}
              </div>
            ) : (
              <Input
                size={headerItem.size ?? null}
                className={headerItem.className}
                name={headerItem.name}
                value={headerItem.value}
                border={headerItem.border}
              />
            ))}
          {!!headerItem.dynamic && headerIndex === rows.headers.length - 1 && (
            <>
              <div className='col-1' />
              <div className='col-1' />
            </>
          )}
        </Fragment>
      ))}
      {rows.headers && <div className='col-1' />}
    </div>
  )
}

const TableRow = ({
  valueItem,
  valueIndex,
  rows,
  readOnly,
  deleteRow,
  onClick,
  onChange,
  name,
  dynamic,
  className,
  deleteRowVisible,
  scrollable,
}) => {
  const is600 = useMediaQuery('(max-width: 576px)')

  const subrows = rows?.subrow?.data?.filter((subrowItem) => {
    return get(subrowItem, rows.subrow.matchKey) === valueItem._id
  })

  return (
    <div className='mb-2'>
      <div
        className={`row mx-0 gx-2 ${className ? className : ''} ${
          onClick ? 'clickable' : ''
        } ${scrollable ? 'scrollable' : ''}`}
        onClick={() => {
          onClick && onClick(valueItem)
        }}
      >
        {rows?.collapse &&
          (subrows?.length > 0 ? (
            <button
              className='btn btn-list-collapse col-1'
              id='sectionCollapseButton'
              type='button'
              data-bs-toggle='collapse'
              data-bs-target={`#${valueItem.name}${valueIndex}Collapse`}
              aria-controls='collapseExample'
              aria-expanded='false'
              onClick={(e) => e.stopPropagation()}
            >
              <i className='bi bi-caret-down' />
            </button>
          ) : (
            <div className='col-1' />
          ))}
        {rows?.inputs?.map((inputItem, inputIndex) => {
          const itemValue =
            getValueFromState(inputItem, valueItem) !== null
              ? getValueFromState(inputItem, valueItem)
              : ''
          return (
            !inputItem.breakpoint &&
            (readOnly || inputItem.readOnly ? (
              <Fragment key={inputIndex}>
                <div className={`${inputItem.size ?? ''}`} key={inputIndex}>
                  {itemValue}
                </div>
                {deleteRowVisible && inputIndex === rows.inputs.length - 1 && (
                  <div className='col-1'>
                    <button
                      className='bi bi-trash3'
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteRow(valueItem)
                      }}
                    />
                  </div>
                )}
              </Fragment>
            ) : (
              <Fragment key={inputIndex}>
                {inputItem.type === 'select' ? (
                  <Select
                    name={`${name}.${valueIndex}.${inputItem.name}`}
                    multiple={inputItem.multiple}
                    placeholder={inputItem.value}
                    value={get(valueItem, inputItem.name)}
                    required={inputItem.required}
                    options={inputItem.options}
                    optionalKey={inputItem.optionalKey}
                    onChange={onChange}
                    size={inputItem.size ?? null}
                  />
                ) : (
                  <Input
                    size={inputItem.size ?? null}
                    name={`${name}.${valueIndex}.${inputItem.name}`}
                    label={inputItem.label ?? false}
                    border={inputItem.border}
                    placeholder={inputItem.value}
                    invalidText={inputItem.invalid}
                    value={get(valueItem, inputItem.name)}
                    required={inputItem.required ?? false}
                    onChange={onChange}
                    validation={inputItem.validation}
                  />
                )}
                {dynamic && inputIndex === rows.inputs.length - 1 && (
                  <>
                    <div
                      className={`col${
                        is600 ? '-2' : '-1'
                      } d-flex align-self-center justify-content-between`}
                    >
                      <i
                        className='bi bi-plus-circle h-100'
                        type='button'
                        name={`${name}`}
                        onClick={(e) => {
                          onChange({
                            type: 'added',
                            payload: { target: { name: name } },
                          })
                        }}
                      />
                      {valueIndex !== 0 && (
                        <i
                          className='bi bi-trash3'
                          type='button'
                          name={`${name}.${valueIndex}`}
                          onClick={(e) =>
                            onChange({
                              type: 'removed',
                              payload: {
                                target: { name: `${name}.${valueIndex}` },
                              },
                            })
                          }
                        />
                      )}
                    </div>
                  </>
                )}
              </Fragment>
            ))
          )
        })}
      </div>
      {rows?.subrow && subrows?.length > 0 && (
        <div
          id={`${valueItem.name}${valueIndex}Collapse`}
          className='section-container collapse'
        >
          {subrows.map((subrowItem, subrowIndex) => (
            <div
              className={`row row-subrow mx-0 ${className ? className : ''} ${
                onClick ? 'clickable' : ''
              } ${scrollable ? 'scrollable' : ''} gx-2`}
              onClick={() => {
                onClick && onClick(subrowItem)
              }}
              key={subrowIndex}
            >
              <div className='col-1'></div>
              {rows.inputs?.map((inputItem, inputIndex) => {
                const itemValue =
                  getValueFromState(inputItem, subrowItem) !== null
                    ? getValueFromState(inputItem, subrowItem)
                    : ''
                return (
                  <Fragment key={inputIndex}>
                    <div className={`${inputItem.size ?? ''}`} key={inputIndex}>
                      {itemValue}
                    </div>
                    {deleteRowVisible &&
                      inputIndex === rows.inputs.length - 1 && (
                        <div className='col-1'>
                          <button
                            className='bi bi-trash3'
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteRow(valueItem)
                            }}
                          />
                        </div>
                      )}
                  </Fragment>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Table({
  rows,
  name,
  value,
  onChange,
  className,
  readOnly,
  dynamic,
  onClick,
  sortable,
  defaultSort,
  scrollable,
  deleteRow,
}) {
  const [sortState, setSortState] = useState()
  const [defaultSortRan, setDefaultSortRan] = useState(false)
  const [isLoadingState, setIsLoadingState] = useState(true)
  const { items, requestSort, sortConfig } = useSortableData(value)

  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  useEffect(() => {
    if (defaultSort && defaultSortRan === false) {
      setDefaultSortRan(true)
      requestSort(defaultSort.name)
    }
  }, [defaultSort, defaultSortRan, requestSort])

  useEffect(() => {
    setSortState({ valueItems: items, sortConfig })
  }, [setSortState, items, sortConfig])

  useEffect(() => {
    const handleLoading = () => {
      setIsLoadingState(false)
    }

    window.addEventListener('load', handleLoading)

    return () => window.removeEventListener('load', handleLoading)
  })

  const getClassNames = (value) => {
    if (!sortState?.sortConfig) {
      return ''
    }
    return sortState.sortConfig.key.sortOn === value
      ? sortState.sortConfig.direction
      : ''
  }

  const filteredItems = rows?.filters
    ? items?.filter((item) => {
        return get(item, rows.filters.filterOn) !== rows.filters.filterValue
      })
    : items

  let content

  if (isLoadingState) {
    content = <Spinner />
  }

  content = (
    <div className={`content-table ${scrollable ? 'scrollable' : ''}`}>
      {rows?.headers && (
        <TableHeader
          rows={rows}
          sortable={sortable}
          requestSort={requestSort}
          getClassNames={getClassNames}
          readOnly={readOnly}
          scrollable={scrollable}
          className={className}
          breakpoint={is1000 || is600}
        />
      )}
      {filteredItems?.map((valueItem, valueIndex) => (
        <Fragment key={valueIndex}>
          <TableRow
            valueItem={valueItem}
            valueIndex={valueIndex}
            rows={rows}
            readOnly={readOnly}
            deleteRow={deleteRow}
            onClick={onClick}
            onChange={onChange}
            name={name}
            dynamic={dynamic}
            className={className}
            deleteRowVisible={deleteRow}
            scrollable={scrollable}
            breakpoint={is1000 || is600}
          />
        </Fragment>
      ))}
    </div>
  )

  return content
}

const memoizedTable = memo(Table)

export default memoizedTable
