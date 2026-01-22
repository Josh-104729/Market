import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { categoryApi, CreateCategoryData, UpdateCategoryData } from "../services/api"
import IconSelector from "../components/IconSelector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Loader2 } from "lucide-react"

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
        icon: data.icon || "",
      })
    } catch (error) {
      console.error("Failed to fetch category:", error)
      alert("Failed to load category")
      navigate("/categories")
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
      navigate("/categories")
    } catch (error) {
      console.error("Failed to save category:", error)
      alert("Failed to save category")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading category</CardTitle>
            <CardDescription>Fetching category details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/categories")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isEditMode ? "Edit Category" : "Create Category"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditMode ? "Update category information." : "Add a new service category."}
            </p>
          </div>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Category details</CardTitle>
          <CardDescription>Provide a title and icon for the category.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="category-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="category-title"
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Web Development"
              />
              <p className="text-xs text-muted-foreground">Enter a descriptive title for the category.</p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Icon</Label>
              <IconSelector
                selectedIcon={formData.icon}
                onSelect={(iconName) => setFormData({ ...formData, icon: iconName })}
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate("/categories")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving..." : isEditMode ? "Update Category" : "Create Category"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default CategoryForm
