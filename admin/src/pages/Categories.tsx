import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolder, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { categoryApi, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'

function Categories() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const data = await categoryApi.getAll()
      setCategories(data)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      alert('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }


  const handleDelete = async (id: string) => {
    try {
      await categoryApi.delete(id)
      setDeleteConfirm(null)
      fetchCategories()
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert('Failed to delete category')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">Categories</h1>
              <p className="text-blue-100">Manage your service categories</p>
            </div>
            <button
              onClick={() => navigate('/categories/new')}
              className="mt-4 sm:mt-0 px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2"
            >
              <FontAwesomeIcon icon={faFolder} />
              <span>Add Category</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {loading ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-md">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-500">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-md">
            <FontAwesomeIcon icon={faFolder} className="text-6xl text-gray-400 mb-4" />
            <p className="text-gray-500 mb-6 text-lg">No categories found</p>
            <button
              onClick={() => navigate('/categories/new')}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
            >
              Create First Category
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Preview
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Icon
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categories.map((category) => (
                    <tr key={category.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className="w-16 h-16 rounded-lg overflow-hidden shadow-sm border-2 border-gray-200 bg-gradient-to-br from-blue-100 to-purple-100"
                        >
                          {category.icon && (
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                              {renderIcon(category.icon)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">{category.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {category.icon ? (
                          <span className="text-3xl">{renderIcon(category.icon)}</span>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(category.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() => navigate(`/categories/${category.id}/edit`)}
                            className="text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-50 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(category.id)}
                            className="text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded hover:bg-red-50 transition-all"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
            <div
              className="bg-white rounded-xl shadow-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Delete Category</h3>
                    <p className="text-sm text-gray-500 mt-1">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete this category? This will soft delete the category (it won't be removed from the database, only marked as deleted and hidden from the frontend).
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all shadow-md hover:shadow-lg"
                  >
                    Delete Category
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Categories

