import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { categoryApi, CreateCategoryData, UpdateCategoryData } from '../services/api'
import IconSelector from '../components/IconSelector'

function CategoryForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditMode = !!id

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<CreateCategoryData>({
    title: '',
    icon: '',
  })

  useEffect(() => {
    if (isEditMode && id) {
      fetchCategory(id)
    }
  }, [id, isEditMode])

  const fetchCategory = async (categoryId: string) => {
    try {
      setLoading(true)
      const data = await categoryApi.getById(categoryId)
      setFormData({
        title: data.title,
        icon: data.icon || '',
      })
    } catch (error) {
      console.error('Failed to fetch category:', error)
      alert('Failed to load category')
      navigate('/categories')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      if (isEditMode && id) {
        const updateData: UpdateCategoryData = {
          title: formData.title || undefined,
          icon: formData.icon || undefined,
        }
        await categoryApi.update(id, updateData)
      } else {
        await categoryApi.create(formData)
      }
      navigate('/categories')
    } catch (error) {
      console.error('Failed to save category:', error)
      alert('Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
          <p className="text-neutral-400">Loading category...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => navigate('/categories')}
              className="text-white hover:text-blue-100 transition-colors p-2 hover:bg-white/10 rounded-lg"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="text-xl" />
            </button>
            <h1 className="text-4xl md:text-5xl font-bold drop-shadow-lg">
              {isEditMode ? 'Edit Category' : 'Create New Category'}
            </h1>
          </div>
          <p className="text-blue-100 ml-12">
            {isEditMode ? 'Update category information' : 'Add a new service category'}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-neutral-800 rounded-xl shadow-md p-8">
            <form onSubmit={handleSubmit}>
              <div className="space-y-8">
                {/* Title Field */}
                <div>
                  <label className="block text-sm font-semibold text-neutral-300 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-600 bg-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="e.g., Web Development"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Enter a descriptive title for the category</p>
                </div>

                {/* Icon Selector */}
                <IconSelector
                  selectedIcon={formData.icon}
                  onSelect={(iconName) => setFormData({ ...formData, icon: iconName })}
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-10 flex justify-end space-x-4 pt-6 border-t border-neutral-700">
                <button
                  type="button"
                  onClick={() => navigate('/categories')}
                  className="px-6 py-3 border-2 border-neutral-600 rounded-lg text-neutral-300 font-semibold hover:bg-neutral-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : isEditMode ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CategoryForm
