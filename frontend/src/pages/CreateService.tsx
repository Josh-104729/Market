import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAppSelector } from "../store/hooks"
import { categoryApi, serviceApi, Category } from "../services/api"
import { showToast } from "../utils/toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Loader2, Plus, UploadCloud, X } from "lucide-react"

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
    <div className="mx-auto w-full max-w-3xl space-y-6 py-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Create service</CardTitle>
              <CardDescription>Add a new listing to the marketplace.</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => {
                // Go back when possible; otherwise fall back to the services list.
                if (window.history.length > 1) navigate(-1)
                else navigate("/services")
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <Label>
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => {
                  setFormData({ ...formData, categoryId: value })
                  setErrors({ ...errors, categoryId: "" })
                }}
              >
                <SelectTrigger className={errors.categoryId ? "border-destructive" : undefined}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId ? (
                <p className="text-sm text-destructive">{errors.categoryId}</p>
              ) : null}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value })
                  setErrors({ ...errors, title: "" })
                }}
                className={errors.title ? "border-destructive" : undefined}
                placeholder="Enter service title"
              />
              {errors.title ? <p className="text-sm text-destructive">{errors.title}</p> : null}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.adText}
                onChange={(e) => {
                  setFormData({ ...formData, adText: e.target.value })
                  setErrors({ ...errors, adText: "" })
                }}
                className={errors.adText ? "border-destructive" : undefined}
                placeholder="Describe your service in detail"
                rows={6}
              />
              {errors.adText ? <p className="text-sm text-destructive">{errors.adText}</p> : null}
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price">
                Price <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={formData.balance}
                onChange={(e) => {
                  setFormData({ ...formData, balance: e.target.value })
                  setErrors({ ...errors, balance: "" })
                }}
                className={errors.balance ? "border-destructive" : undefined}
                placeholder="0.00"
              />
              {errors.balance ? <p className="text-sm text-destructive">{errors.balance}</p> : null}
            </div>

            {/* Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>
                  Service image <span className="text-destructive">*</span>
                </Label>
                {imagePreview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setImageFile(null)
                      setImagePreview(null)
                      setErrors((prev) => ({ ...prev, image: "" }))
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>

              {imagePreview ? (
                <div className="rounded-lg border p-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-64 w-full rounded-md object-contain"
                  />
                </div>
              ) : (
                <div
                  className={[
                    "rounded-lg border border-dashed p-6",
                    "flex items-center justify-between gap-4",
                    errors.image ? "border-destructive" : "border-border",
                  ].join(" ")}
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Upload a file</div>
                    <div className="text-xs text-muted-foreground">PNG, JPG, GIF, WEBP up to 5MB</div>
                  </div>
                  <Button type="button" variant="secondary" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="h-4 w-4" />
                    Choose file
                  </Button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
              />

              {errors.image ? <p className="text-sm text-destructive">{errors.image}</p> : null}
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>
                Tags <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                  className={errors.tags ? "border-destructive" : undefined}
                  placeholder="Enter a tag and press Enter"
                />
                <Button type="button" variant="secondary" className="shrink-0 gap-2" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              {formData.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      <span className="max-w-[220px] truncate">{tag}</span>
                      <button
                        type="button"
                        className="ml-1 inline-flex items-center"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}

              {errors.tags ? <p className="text-sm text-destructive">{errors.tags}</p> : null}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate("/services")}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? "Creating..." : "Create service"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default CreateService

