import { useEffect, useState, Fragment, memo, useId } from 'react'
import useSortableData from '../../hooks/useSortableData'
import { getValueFromState } from '../../utils/formatting'
import { PropertyPath, get } from 'lodash'
import Input from '../Input/Input'
import Dropdown from '../Dropdown/Dropdown'
import Spinner from '../Spinner/Spinner'
import Grid from '../Grid/Grid'
import Button from '../Button/Button'
import {
  SortConfig,
  RowInput,
  RowHeader,
  DropdownOption,
  ReducerActionType,
} from '../../utils/types'
import {
  table,
  table_row,
  table_collapse_button,
  table_header,
  table_header_row,
  table_subrow,
  table_dynamic_button,
  table_cell,
  table_button_cell,
  table_body,
} from './Table.css'
import { TbCaretUpFilled, TbTrash, TbCirclePlus } from 'react-icons/tb'
import clsx from 'clsx'
import ScrollArea from '../ScrollArea/ScrollArea'
import useIsLoading from '../../hooks/useIsLoading'
import { useMediaQuery } from 'usehooks-ts'

type RowData = {
  inputs: RowInput[]
  headers: RowHeader[]
  filters?: {
    filterOn: string
    filterValue: string
  }
  subrow?:
    | false
    | {
        data: any[]
        matchKey: string
      }
}

interface SortState {
  valueItems: any[]
  sortConfig: SortConfig
}

interface TableHeaderProps {
  headers: RowHeader[]
  collapse?: boolean
  sortable?: boolean
  requestSort: (key: SortConfig['key']) => void
  getClassNames: (arg: string) => void
  deleteRow?: (arg: any) => void
  addRow?: boolean
  border?: boolean
}

interface TableRowProps {
  valueItem: any
  valueIndex: number
  rows: RowData
  readOnly?: boolean
  deleteRow?: (arg: any) => void
  addRow?: boolean
  onClick?: (arg: any) => void
  name: string | undefined
  onChange?: (arg: ReducerActionType) => void
  collapse?: boolean
  border?: boolean
}

interface TableProps {
  rows: RowData
  name?: string | undefined
  addRow?: boolean
  value: any[]
  readOnly?: boolean
  onClick?: (arg: any) => void
  sortable?: boolean
  defaultSort?: any
  clickable?: boolean
  deleteRow?: (arg: any) => void
  onChange?: (arg: ReducerActionType) => void
  collapse?: boolean
  empty?: string
  id?: string | undefined
  scrollable?: 'horizontal' | 'vertical' | 'all' | 'none'
  border?: boolean
}

const TableHeader = ({
  headers,
  collapse,
  sortable,
  requestSort,
  getClassNames,
  addRow,
  deleteRow,
  border,
}: TableHeaderProps) => {
  const sm = useMediaQuery('screen and (max-width: 567px)')
  const md = useMediaQuery(
    'screen and (min-width: 568px) and (max-width: 1023px)'
  )

  return (
    <Grid
      cols={{
        start: collapse ? 1 : 0,
        end: addRow ? 2 : deleteRow ? 1 : 0,
      }}
      className={clsx(table_header_row, { ['borderless']: border === false })}
    >
      {collapse && <div className={table_header} />}
      {headers?.map((headerItem: RowHeader, headerIndex: number) => {
        return (
          !headerItem.breakpoint?.some(
            (breakpointItem) =>
              (breakpointItem === 'sm' && sm) || (breakpointItem === 'md' && md)
          ) && (
            <Fragment key={headerIndex}>
              {
                <div
                  className={clsx(
                    {
                      [`${
                        headerItem.name &&
                        getClassNames(
                          typeof headerItem.name === 'object'
                            ? headerItem.name?.sortOn
                            : headerItem.name
                        )
                      }`]: headerItem.name,
                    },
                    { ['required']: headerItem.required },
                    table_header
                  )}
                  onClick={() =>
                    sortable &&
                    requestSort(headerItem.name as SortConfig['key'])
                  }
                >
                  {headerItem.value}
                </div>
              }
            </Fragment>
          )
        )
      })}
      {addRow && <div className={table_header} />}
      {deleteRow && <div className={table_header} />}
    </Grid>
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
  addRow,
  collapse,
  border,
}: TableRowProps) => {
  const [collapsed, setCollapsed] = useState(true)

  const sm = useMediaQuery('screen and (max-width: 567px)')
  const md = useMediaQuery(
    'screen and (min-width: 568px) and (max-width: 1023px)'
  )

  const subrows =
    rows.subrow &&
    rows.subrow?.data?.filter((subrowItem: any) => {
      if (rows.subrow) {
        return get(subrowItem, rows?.subrow.matchKey) === valueItem._id
      }
    })

  return (
    <>
      <Grid
        cols={{
          start: collapse ? 1 : 0,
          end: addRow ? 2 : deleteRow ? 1 : 0,
        }}
        className={clsx(
          table_row,
          'table_row',
          { ['clickable']: onClick },
          { ['collapsed']: collapsed },
          { ['borderless']: border === false }
        )}
        onClick={() => {
          onClick && onClick(valueItem)
        }}
      >
        {collapse && (
          <div
            className={table_button_cell}
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed((prev) => !prev)
            }}
          >
            {collapse && subrows && subrows?.length > 0 && (
              <Button
                variant='unstyled'
                className={clsx(table_collapse_button, {
                  ['collapsed']: collapsed,
                })}
              >
                <TbCaretUpFilled />
              </Button>
            )}
          </div>
        )}
        {rows.inputs?.map((inputItem: RowInput, inputIndex: number) => {
          const itemValue =
            getValueFromState(inputItem, valueItem) !== null
              ? getValueFromState(inputItem, valueItem)
              : ''
          return (
            !inputItem.breakpoint?.some(
              (breakpointItem) =>
                (breakpointItem === 'sm' && sm) ||
                (breakpointItem === 'md' && md)
            ) && (
              <Fragment key={inputIndex}>
                {readOnly || inputItem.readOnly ? (
                  <div className={table_cell}>{itemValue}</div>
                ) : (
                  <div className={table_cell}>
                    {inputItem.type === 'select' ? (
                      <Dropdown
                        name={`${name}.${valueIndex}.${inputItem.name}`}
                        label={inputItem.label}
                        multiSelect={inputItem.multiple}
                        placeholder={inputItem.placeholder}
                        value={get(valueItem, inputItem?.name as PropertyPath)}
                        required={inputItem.required}
                        options={inputItem.options as DropdownOption[]}
                        optionalKey={inputItem.optionalKey}
                        onChange={(e) => onChange && onChange(e)}
                      />
                    ) : (
                      <Input
                        name={`${name}.${valueIndex}.${inputItem.name}`}
                        label={inputItem.label ?? false}
                        placeholder={inputItem.placeholder}
                        errorMsg={inputItem.errorMsg}
                        value={get(valueItem, inputItem.name as PropertyPath)}
                        required={inputItem.required}
                        onChange={(e) => onChange && onChange(e)}
                        validation={inputItem.validation}
                        autoComplete='off'
                      />
                    )}
                  </div>
                )}
              </Fragment>
            )
          )
        })}
        {addRow && (
          <div
            className={table_button_cell}
            onClick={() => {
              onChange &&
                onChange({
                  type: 'added',
                  target: { name: name },
                })
            }}
          >
            <Button
              className={table_dynamic_button}
              variant='unstyled'
              type='button'
              name={`${name}`}
            >
              <TbCirclePlus />
            </Button>
            {valueIndex !== 0 && (
              <div
                className={table_button_cell}
                onClick={() =>
                  onChange &&
                  onChange({
                    type: 'removed',
                    target: { name: `${name}.${valueIndex}` },
                  })
                }
              >
                <Button
                  className={table_dynamic_button}
                  variant='unstyled'
                  type='button'
                  name={`${name}.${valueIndex}`}
                >
                  <TbTrash />
                </Button>
              </div>
            )}
          </div>
        )}
        {deleteRow && (
          <div
            className={table_button_cell}
            onClick={(e) => {
              e.stopPropagation()
              deleteRow && deleteRow(valueItem)
            }}
          >
            <Button
              className={table_dynamic_button}
              variant='unstyled'
              type='button'
            >
              <TbTrash />
            </Button>
          </div>
        )}
      </Grid>
      {rows?.subrow &&
        subrows &&
        subrows?.length > 0 &&
        subrows.map((subrowItem: any, subrowIndex: number) => (
          <Grid
            cols={{
              start: collapse ? 1 : 0,
              end: addRow ? 2 : deleteRow ? 1 : 0,
            }}
            className={clsx(
              table_subrow,
              { ['clickable']: onClick },
              { ['collapsed']: collapsed }
            )}
            onClick={() => {
              onClick && onClick(subrowItem)
            }}
            key={subrowIndex}
          >
            <div className={table_button_cell} />
            {rows.inputs?.map((inputItem: any, inputIndex: number) => {
              const itemValue =
                getValueFromState(inputItem, subrowItem) !== null
                  ? getValueFromState(inputItem, subrowItem)
                  : ''
              return (
                !inputItem.breakpoint && (
                  <Fragment key={inputIndex}>
                    <div className={table_cell}>{itemValue}</div>
                  </Fragment>
                )
              )
            })}
            {deleteRow && (
              <div
                className={table_button_cell}
                onClick={(e) => {
                  e.stopPropagation()
                  deleteRow(valueItem)
                }}
              >
                <Button
                  className={table_dynamic_button}
                  variant='unstyled'
                  type='button'
                >
                  <TbTrash />
                </Button>
              </div>
            )}
          </Grid>
        ))}
    </>
  )
}

const Table = memo(
  ({
    rows,
    name,
    value,
    onChange,
    readOnly,
    onClick,
    sortable,
    defaultSort,
    deleteRow,
    addRow,
    collapse,
    scrollable = 'none',
    id,
    border,
  }: TableProps) => {
    const isLoading = useIsLoading()

    const [sortState, setSortState] = useState<SortState>()
    const [defaultSortRan, setDefaultSortRan] = useState(false)
    const { items, requestSort, sortConfig } = useSortableData(value)

    const bodyId = useId()

    const tableBody = document.getElementById(`${bodyId}`)

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLInputElement
        if (target?.tagName === 'INPUT' && tableBody) {
          const focusedElement: HTMLInputElement = target

          if (
            event.key === 'ArrowLeft' ||
            event.key === 'ArrowRight' ||
            event.key === 'ArrowUp' ||
            event.key === 'ArrowDown'
          ) {
            event.preventDefault()

            const currentRow = focusedElement.closest('.table_row')
            const siblingRows = Array.from(
              tableBody.querySelectorAll('.table_row')
            )
            const currentRowIndex = siblingRows.indexOf(currentRow as Element)
            const currentElements = (currentRow as Element).querySelectorAll(
              'input'
            )
            const currentIndex = Array.from(currentElements).findIndex(
              (element) => element.name === focusedElement.name
            )
            if (currentRowIndex === -1) return

            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              const nextInputIncrement = event.key === 'ArrowRight' ? 1 : -1

              const nextInput = currentIndex + nextInputIncrement

              if (nextInput !== -1 && nextInput !== currentElements.length) {
                currentElements[nextInput].focus()
              }
            } else {
              const rowIncrement = event.key === 'ArrowDown' ? 1 : -1
              const nextRow =
                siblingRows[(currentRowIndex as number) + rowIncrement]
              if (!nextRow) return

              const nextElements = nextRow.querySelectorAll('input')
              const nextIndex = Array.from(nextElements).findIndex(
                (_, index) => index === currentIndex
              )

              if (nextIndex !== -1 && nextIndex !== siblingRows.length - 1) {
                nextElements[nextIndex].focus()
              }
            }
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }, [tableBody])

    useEffect(() => {
      if (defaultSort != null && defaultSortRan === false) {
        setDefaultSortRan(true)
        requestSort(defaultSort.name)
      }
    }, [defaultSort, defaultSortRan, requestSort])

    useEffect(() => {
      setSortState({ valueItems: items, sortConfig } as any)
    }, [setSortState, items, sortConfig])

    const getClassNames = (value: string) => {
      if (!sortState?.sortConfig) {
        return ''
      }
      return sortState.sortConfig.key.sortOn === value
        ? sortState.sortConfig.direction
        : ''
    }

    const filteredItems = rows?.filters
      ? items?.filter((item: any) => {
          return (
            get(item, rows.filters?.filterOn as PropertyPath) !==
            rows.filters?.filterValue
          )
        })
      : items

    return isLoading ? (
      <Spinner />
    ) : (
      <ScrollArea
        className={clsx(table)}
        scrollDirection={
          scrollable === 'horizontal' || scrollable === 'all'
            ? 'horizontal'
            : 'none'
        }
        id={id}
      >
        {rows?.headers && (
          <TableHeader
            headers={rows.headers}
            sortable={sortable}
            requestSort={requestSort}
            getClassNames={getClassNames}
            collapse={collapse}
            deleteRow={deleteRow}
            addRow={addRow}
            border={border}
          />
        )}
        <ScrollArea
          scrollDirection={scrollable !== 'horizontal' ? 'vertical' : 'none'}
          scrollWrapperOverflow={scrollable === 'horizontal' ? 'off' : 'hidden'}
          className={clsx(table_body)}
          id={bodyId}
        >
          {filteredItems?.map((valueItem: any, valueIndex: number) => (
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
                addRow={addRow}
                collapse={collapse}
                border={border}
              />
            </Fragment>
          ))}
        </ScrollArea>
      </ScrollArea>
    )
  }
)

Table.displayName = 'Table'

export default Table
