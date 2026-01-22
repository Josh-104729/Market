import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { categoryApi, Category } from "../services/api"
import { renderIcon } from "../utils/iconHelper"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, Folder, FolderPlus, Pencil, Trash2 } from "lucide-react"

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
      console.error("Failed to fetch categories:", error)
      alert("Failed to load categories")
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
      console.error("Failed to delete category:", error)
      alert("Failed to delete category")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage your service categories.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Total: {categories.length}</Badge>
          <Button onClick={() => navigate("/categories/new")}>
            <FolderPlus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Category List</CardTitle>
            <CardDescription>Preview, edit, or remove service categories.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
              <Folder className="h-8 w-8" />
              <div>No categories found.</div>
              <Button variant="outline" onClick={() => navigate("/categories/new")}>
                Create First Category
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preview</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Icon</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted/30 text-2xl">
                          {category.icon ? renderIcon(category.icon) : <Folder className="h-6 w-6" />}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">{category.title}</TableCell>
                      <TableCell className="text-2xl">
                        {category.icon ? renderIcon(category.icon) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(category.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/categories/${category.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(category.id)}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(deleteConfirm)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null)
        }}
      >
        <DialogContent>
          {deleteConfirm && (
            <>
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <DialogHeader className="text-left">
                  <DialogTitle>Delete Category</DialogTitle>
                  <DialogDescription>This action cannot be undone.</DialogDescription>
                </DialogHeader>
              </div>
              <div className="text-sm text-muted-foreground">
                Are you sure you want to delete this category? This will soft delete the category (it won't be removed
                from the database, only marked as deleted and hidden from the frontend).
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>
                  Delete Category
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Categories
