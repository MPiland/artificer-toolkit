import '../css/table.css'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import useSortableData from '../hooks/useSortableData'
import { get } from 'lodash'
import Input from './Input'
import TextEditor from './TextEditor'

const NUM_REGEX = /^[0-9\b]+$/

const Table = forwardRef(
  (
    {
      inputs,
      name,
      value,
      onChange,
      className,
      dynamic,
      headers,
      readOnly,
      clickable,
      onClick,
      empty,
      sortable,
      scrollable,
    },
    ref
  ) => {
    const [sortState, setSortState] = useState()
    const { items, requestSort, sortConfig } = useSortableData(value)

    useEffect(() => {
      setSortState({ items: items, sortConfig: sortConfig })
    }, [setSortState, items, sortConfig])

    const getClassNames = (value) => {
      if (!sortState?.sortConfig) {
        return
      }
      if (Array.isArray(sortState.sortConfig.key)) {
        return sortState.sortConfig.key[0] === value
          ? sortState.sortConfig.direction
          : ''
      } else {
        return sortState.sortConfig.key === value
          ? sortState.sortConfig.direction
          : ''
      }
    }

    const getValueFromState = (inputItem, valueItem) => {
      const processItem = (item, state) => {
        if (Array.isArray(item)) {
          return item
            .map((nestedItem) => processItem(nestedItem, state))
            .join(' ')
        } else {
          const value = get(state, item)
          if (Array.isArray(value)) {
            if (value.length > 0) {
              if (value.length > 1) {
                const sortedValues = [...value] // Create a new array to avoid modifying the original
                sortedValues.sort((a, b) =>
                  a.value.toString().localeCompare(b.value.toString())
                )
                return sortedValues
                  .map((nestedValue) => nestedValue.value)
                  .join(' / ')
              } else {
                return value[0].value
              }
            } else {
              return empty ? empty : null
            }
          } else {
            return value
          }
        }
      }

      if (inputItem && inputItem.name) {
        const nameItems = Array.isArray(inputItem.name[0])
          ? inputItem.name
          : [inputItem.name]
        return nameItems
          .map((nameItem) => {
            const value = processItem(nameItem, valueItem)
            return value !== undefined ? value : empty ? empty : null
          })
          .join(' / ')
      }

      return empty ? empty : null
    }

    const content = (
      <div className={`${scrollable ? 'table-scrollable' : ''}`}>
        {headers && (
          <div className={`row align-items-center pb-2 g-2`}>
            {headers?.map((headerItem, headerIndex) => {
              return (
                !headerItem.breakpoint &&
                (readOnly ? (
                  <div
                    className={`${headerItem.size ?? ''} ${
                      headerItem.className ?? ''
                    }  ${getClassNames(headerItem.value)} ${
                      sortable ? 'sortable-header' : ''
                    }`}
                    key={headerIndex}
                    onClick={() =>
                      sortable &&
                      requestSort(headerItem.value, headerItem.order)
                    }
                  >
                    {headerItem.name}
                  </div>
                ) : (
                  <Input
                    size={headerItem.size ?? null}
                    className={headerItem.className}
                    key={headerIndex}
                    name={headerItem.name}
                    value={headerItem.name}
                    readOnly={readOnly === true ? true : false}
                    border={headerItem.border}
                  />
                ))
              )
            })}
          </div>
        )}
        {sortState?.items?.map((valueItem, itemIndex) => (
          <div
            key={itemIndex}
            className={`row pb-2 g-2 ${className ?? ''} ${
              clickable ? 'row-clickable' : ''
            } ${scrollable ? 'scrollable' : ''}`}
            onClick={() => {
              onClick && onClick(valueItem)
            }}
          >
            {inputs?.map((inputItem, inputIndex) => {
              return (
                !inputItem.breakpoint &&
                (readOnly ? (
                  <div className={`${inputItem.size ?? ''}`} key={inputIndex}>
                    {getValueFromState(inputItem, valueItem) !== null
                      ? getValueFromState(inputItem, valueItem)
                      : ''}
                  </div>
                ) : !!inputItem.type && inputItem.type === 'text' ? (
                  <TextEditor
                    short={inputItem.short}
                    size={inputItem.size ?? ''}
                    noMenuBar={true}
                    placeholder={`${inputItem.value}`}
                    name={`${name}.${itemIndex}.${inputItem.name}`}
                    value={getValueFromState(inputItem, valueItem)}
                    key={inputIndex}
                    onChange={onChange}
                  />
                ) : (
                  <Input
                    className={`${
                      inputItem.validation === true &&
                      valueItem[inputItem.name] &&
                      (NUM_REGEX.test(valueItem[inputItem.name])
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    size={inputItem.size ?? null}
                    name={`${name}.${itemIndex}.${inputItem.name}`}
                    label={inputItem.label ?? false}
                    border={inputItem.border}
                    key={inputIndex}
                    placeholder={inputItem.value}
                    invalidText={inputItem.invalid}
                    value={
                      getValueFromState(inputItem, valueItem) !== null
                        ? getValueFromState(inputItem, valueItem)
                        : ''
                    }
                    onChange={onChange}
                    readOnly={readOnly === true ? true : false}
                  />
                ))
              )
            })}
            {!!dynamic && (
              <>
                <div className='col-1'>
                  <button
                    className='bi bi-plus-circle'
                    type='button'
                    name={`${name}`}
                    onClick={(e) => onChange({ type: 'added', payload: e })}
                  />
                </div>
                <div className='col-1'>
                  {itemIndex !== 0 && (
                    <button
                      className='bi bi-trash3'
                      type='button'
                      name={`${name}.${itemIndex}`}
                      onClick={(e) => onChange({ type: 'removed', payload: e })}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    )

    useImperativeHandle(ref, () => ({
      getSortState() {
        return sortState
      },
      setSortState(value) {
        setSortState(value)
      },
    }))

    return content
  }
)
export default Table
