import { Link } from 'react-router-dom'
import { useGetSpellQuery } from './spellsApiSlice'
import Spell from './Spell'

const SpellList = ({ id }) => {
  const {
    data: spells,
    isLoading,
    isSuccess,
    isError,
    error,
  } = useGetSpellQuery(id)

  let content

  if (isLoading) content = <p>Loading...</p>

  if (isError) {
    content = <p className='errmsg'>{error?.data?.message}</p>
  }

  if (isSuccess) {
    const tableContent =
      spells?.length &&
      spells.map((spell) => <Spell spell={spell} key={spell._id} />)

    content = (
      <>
        <div className='row align-items-center'>
          <div className='d-inline col-auto me-auto'>
            <h1>Spells</h1>
          </div>
          <div className='d-inline col-auto ms-auto'>
            <Link
              to={{ pathname: '/spells/new' }}
              className='btn btn-outline-secondary'
            >
              Add a spell
            </Link>
          </div>
        </div>
        <div className='table-responsive'>
          <table className='table table-hover'>
            <thead>
              <tr className='row-cols-lg-auto'>
                <th scope='col' className='col-auto'>
                  LEVEL
                </th>
                <th scope='col' className='col-auto'>
                  SPELL NAME
                </th>
                <th scope='col' className='col-auto'>
                  CASTING TIME
                </th>
                <th scope='col' className='col-auto'>
                  DURATION
                </th>
                <th scope='col' className='d-none d-lg-table-cell col-auto'>
                  RANGE/AREA
                </th>
                <th scope='col' className='d-none d-lg-table-cell col-auto'>
                  DAMAGE/EFFECT
                </th>
              </tr>
            </thead>
            <tbody>{tableContent}</tbody>
          </table>
        </div>
      </>
    )

    return content
  }
}
export default SpellList
