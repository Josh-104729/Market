import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTimes, faUpload, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { useAppSelector } from '../store/hooks'
import { categoryApi, serviceApi, Category } from '../services/api'
import { showToast } from '../utils/toast'

function CreateService() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [categories, setCategories] = useState<Category[]>([])
  const [submitting, setSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    categoryId: '',
    title: '',
    adText: '',
    balance: '',
    tags: [] as string[],
  })
  const [tagInput, setTagInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }
    fetchCategories()
  }, [isAuthenticated, navigate])

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.getAll()
      setCategories(data)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      showToast.error('Failed to load categories')
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    
    // Reset previous state
    setImageFile(null)
    setImagePreview(null)
    setErrors((prev) => ({ ...prev, image: '' }))
    
    if (!file) {
      return
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, image: 'Only JPG, PNG, GIF, or WEBP image files are allowed' }))
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: 'Image size must be less than 5MB' }))
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }
    
    // File is valid, set it
    setImageFile(file)
    setErrors((prev) => ({ ...prev, image: '' }))
    
    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.onerror = () => {
      setErrors((prev) => ({ ...prev, image: 'Failed to load image preview' }))
      setImageFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim()
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData({ ...formData, tags: [...formData.tags, trimmedTag] })
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors: Record<string, string> = {}
    if (!formData.categoryId) newErrors.categoryId = 'Category is required'
    if (!formData.title.trim()) newErrors.title = 'Title is required'
    if (!formData.adText.trim()) newErrors.adText = 'Description is required'
    const balanceValue = parseFloat(formData.balance)
    if (!formData.balance || isNaN(balanceValue) || balanceValue <= 0) {
      newErrors.balance = 'Balance must be greater than 0'
    }
    if (!imageFile) newErrors.image = 'Image is required'
    if (formData.tags.length === 0) newErrors.tags = 'At least one tag is required'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      setSubmitting(true)
      const balanceValue = parseFloat(formData.balance)
      await serviceApi.create(
        {
          categoryId: formData.categoryId,
          title: formData.title.trim(),
          adText: formData.adText.trim(),
          balance: Math.round(balanceValue * 100) / 100, // Round to 2 decimal places to avoid floating point issues
          tags: formData.tags,
        },
        imageFile!,
      )
      showToast.success('Service created successfully!')
      navigate('/services')
    } catch (error: any) {
      console.error('Failed to create service:', error)
      const errorMessage = error.response?.data?.message || 'Failed to create service'
      showToast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-neutral-900 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="bg-neutral-800 rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-neutral-100 mb-8">Create New Service</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => {
                  setFormData({ ...formData, categoryId: e.target.value })
                  setErrors({ ...errors, categoryId: '' })
                }}
                className={`w-full px-4 py-3 border bg-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.categoryId ? 'border-red-500' : 'border-neutral-600'
                }`}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.title}
                  </option>
                ))}
              </select>
              {errors.categoryId && <p className="mt-1 text-sm text-red-400">{errors.categoryId}</p>}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value })
                  setErrors({ ...errors, title: '' })
                }}
                className={`w-full px-4 py-3 border bg-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-500' : 'border-neutral-600'
                }`}
                placeholder="Enter service title"
              />
              {errors.title && <p className="mt-1 text-sm text-red-400">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={formData.adText}
                onChange={(e) => {
                  setFormData({ ...formData, adText: e.target.value })
                  setErrors({ ...errors, adText: '' })
                }}
                rows={6}
                className={`w-full px-4 py-3 border bg-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.adText ? 'border-red-500' : 'border-neutral-600'
                }`}
                placeholder="Describe your service in detail"
              />
              {errors.adText && <p className="mt-1 text-sm text-red-400">{errors.adText}</p>}
            </div>

            {/* Balance */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Price <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.balance}
                onChange={(e) => {
                  setFormData({ ...formData, balance: e.target.value })
                  setErrors({ ...errors, balance: '' })
                }}
                className={`w-full px-4 py-3 border bg-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.balance ? 'border-red-500' : 'border-neutral-600'
                }`}
                placeholder="0.00"
              />
              {errors.balance && <p className="mt-1 text-sm text-red-400">{errors.balance}</p>}
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Service Image <span className="text-red-400">*</span>
              </label>
              <div
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors ${
                  errors.image
                    ? 'border-red-500 bg-red-900'
                    : imagePreview
                    ? 'border-green-700 bg-green-900'
                    : 'border-neutral-600 hover:border-blue-500'
                }`}
              >
                <div className="space-y-1 text-center">
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null)
                          setImagePreview(null)
                          setErrors((prev) => ({ ...prev, image: '' }))
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                          }
                        }}
                        className="mt-2 text-sm text-red-400 hover:text-red-300 font-medium"
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <>
                      <FontAwesomeIcon
                        icon={faUpload}
                        className={`mx-auto h-12 w-12 ${errors.image ? 'text-red-400' : 'text-neutral-400'}`}
                      />
                      <div className="flex text-sm text-neutral-400">
                        <label className="relative cursor-pointer bg-neutral-700 rounded-md font-medium text-blue-400 hover:text-blue-500">
                          <span>Upload a file</span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="sr-only"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            onChange={handleImageChange}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-neutral-400">PNG, JPG, GIF, WEBP up to 5MB</p>
                    </>
                  )}
                </div>
              </div>
              {errors.image && (
                <p className="mt-1 text-sm text-red-400 font-medium flex items-center">
                  <span className="mr-1">⚠</span>
                  {errors.image}
                </p>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Tags <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                  className={`flex-1 px-4 py-2 border bg-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.tags ? 'border-red-500' : 'border-neutral-600'
                  }`}
                  placeholder="Enter a tag and press Enter"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900 text-blue-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 text-blue-400 hover:text-blue-200"
                    >
                      <FontAwesomeIcon icon={faTimes} className="text-xs" />
                    </button>
                  </span>
                ))}
              </div>
              {errors.tags && <p className="mt-1 text-sm text-red-400">{errors.tags}</p>}
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/services')}
                className="flex-1 px-6 py-3 border-2 border-neutral-600 text-neutral-300 rounded-lg font-semibold hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Service'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateService

