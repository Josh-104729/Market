import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faStar } from "@fortawesome/free-solid-svg-icons"
import { faStar as faStarRegular, faStarHalfStroke } from "@fortawesome/free-regular-svg-icons"
import { serviceApi, categoryApi, Service, Category } from "../services/api"
import { renderIcon } from "../utils/iconHelper"
import ImageWithLoader from "../components/ImageWithLoader"
import { useDefaultServiceImageSrc } from "../hooks/use-default-service-image"
import { formatPaymentDurationSuffix } from "../utils/paymentDuration"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, Ban, Check, Search } from "lucide-react"

const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

  return (
    <div className="flex items-center gap-1">
      {[...Array(fullStars)].map((_, i) => (
        <FontAwesomeIcon key={`full-${i}`} icon={faStar} className="text-yellow-400" />
      ))}
      {hasHalfStar && <FontAwesomeIcon icon={faStarHalfStroke} className="text-yellow-400" />}
      {[...Array(emptyStars)].map((_, i) => (
        <FontAwesomeIcon key={`empty-${i}`} icon={faStarRegular} className="text-neutral-300" />
      ))}
    </div>
  )
}

interface ConfirmDialog {
  serviceId: string
  serviceTitle: string
  action: 'approve' | 'block' | 'unblock'
  newStatus: 'draft' | 'active' | 'blocked'
}

function Services() {
  const navigate = useNavigate()
  const defaultServiceImageSrc = useDefaultServiceImageSrc()
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Calculate total service count (sum of all category service counts)
  const totalServiceCount = categories.reduce((sum, category) => {
    return sum + (category.serviceCount || 0)
  }, 0)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters or page size change
  }, [statusFilter, selectedCategory, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when search changes
  }, [searchTerm])

  // Debounced search effect - only triggers fetch after user stops typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchServices()
    }, searchTerm ? 500 : 0) // 500ms debounce for search, immediate for other filters
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, selectedCategory, searchTerm, itemsPerPage])

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.getAll()
      setCategories(data)
    } catch (error) {
      console.error("Failed to fetch categories:", error)
    }
  }

  const fetchServices = async () => {
    try {
      setLoading(true)
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      }
      if (statusFilter) {
        params.status = statusFilter
      }
      if (selectedCategory) {
        params.categoryId = selectedCategory
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim()
      }
      const response = await serviceApi.getAll(params)
      setServices(response.data)
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (error) {
      console.error("Failed to fetch services:", error)
      alert("Failed to load services")
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChangeClick = (
    id: string,
    title: string,
    action: "approve" | "block" | "unblock",
    newStatus: "draft" | "active" | "blocked"
  ) => {
    setConfirmDialog({
      serviceId: id,
      serviceTitle: title,
      action,
      newStatus,
    })
  }

  const handleStatusChange = async () => {
    if (!confirmDialog) return

    try {
      await serviceApi.updateStatus(confirmDialog.serviceId, confirmDialog.newStatus)
      setConfirmDialog(null)
      fetchServices()
    } catch (error) {
      console.error("Failed to update service status:", error)
      alert("Failed to update service status")
      setConfirmDialog(null)
    }
  }

  const getStatusBadgeVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active":
        return "default"
      case "blocked":
        return "destructive"
      case "draft":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getServiceRating = (service: Service) => {
    const rating =
      service.averageRating !== undefined && service.averageRating > 0 ? service.averageRating : service.rating
    if (rating === undefined || rating === null) return 0
    return typeof rating === "number" ? rating : parseFloat(String(rating))
  }

  const getServicePrice = (service: Service) => {
    const value = typeof service.balance === "number" ? service.balance : parseFloat(service.balance as any)
    if (Number.isNaN(value)) return "0.00"
    return (Math.round(value * 100) / 100).toFixed(2)
  }

  const paginationMeta = useMemo(() => {
    const maxVisible = 5
    const pageCount = Math.max(totalPages, 1)
    let start = Math.max(1, currentPage - 2)
    let end = Math.min(pageCount, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)
    const pages = []
    for (let page = start; page <= end; page += 1) {
      pages.push(page)
    }
    return {
      pages,
      showLeftEllipsis: start > 1,
      showRightEllipsis: end < pageCount,
    }
  }, [currentPage, totalPages])

  const startItem = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, total)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground">Review and manage all services.</p>
        </div>
        <Badge variant="secondary">Total services: {totalServiceCount}</Badge>
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search by title, description, or tags.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search services..."
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={selectedCategory || "all"}
              onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories ({totalServiceCount})</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className="flex items-center gap-2">
                      {category.icon ? renderIcon(category.icon, "text-sm") : null}
                      <span>{category.title}</span>
                      {category.serviceCount ? (
                        <span className="text-muted-foreground">({category.serviceCount})</span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Showing {startItem} to {endItem} of {total} services
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Services List</CardTitle>
            <CardDescription>Approve, block, or review service listings.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(value) => {
                setCurrentPage(1)
                setItemsPerPage(Number(value))
              }}
            >
              <SelectTrigger className="w-[90px]">
                <SelectValue placeholder={itemsPerPage} />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          ) : services.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <Search className="h-5 w-5" />
              No services found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <div className="h-16 w-16 overflow-hidden rounded-lg border bg-muted/30">
                          <ImageWithLoader
                            src={service.adImage?.trim() ? service.adImage : defaultServiceImageSrc}
                            alt={service.title}
                            className="max-w-full max-h-full object-contain"
                            containerClassName="h-full w-full"
                            showBlurBackground={true}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <button
                          type="button"
                          className="text-left text-sm font-semibold text-foreground hover:text-primary transition-colors"
                          onClick={() => navigate(`/services/${service.id}`)}
                        >
                          {service.title}
                        </button>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {service.adText || "No description provided."}
                        </div>
                      </TableCell>
                      <TableCell>{service.category?.title || "N/A"}</TableCell>
                      <TableCell>
                        {service.user?.firstName && service.user?.lastName
                          ? `${service.user.firstName} ${service.user.lastName}`
                          : service.user?.userName || service.user?.email || "N/A"}
                      </TableCell>
                      <TableCell>
                        <StarRating rating={getServiceRating(service)} />
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        ${getServicePrice(service)}
                        {formatPaymentDurationSuffix(service.paymentDuration)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(service.status)} className="capitalize">
                          {service.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(service.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {service.status === "draft" && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChangeClick(service.id, service.title, "approve", "active")}
                            >
                              <Check className="h-4 w-4" />
                              Approve
                            </Button>
                          )}
                          {service.status === "active" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleStatusChangeClick(service.id, service.title, "block", "blocked")}
                            >
                              <Ban className="h-4 w-4" />
                              Block
                            </Button>
                          )}
                          {service.status === "blocked" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChangeClick(service.id, service.title, "unblock", "active")}
                            >
                              <Check className="h-4 w-4" />
                              Unblock
                            </Button>
                          )}
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

      {!loading && total > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {total} services
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault()
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }}
                />
              </PaginationItem>
              {paginationMeta.showLeftEllipsis && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              {paginationMeta.pages.map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    isActive={page === currentPage}
                    onClick={(event) => {
                      event.preventDefault()
                      setCurrentPage(page)
                    }}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              {paginationMeta.showRightEllipsis && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault()
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <Dialog
        open={Boolean(confirmDialog)}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null)
        }}
      >
        <DialogContent>
          {confirmDialog && (
            <>
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    confirmDialog.action === "block" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                  }`}
                >
                  {confirmDialog.action === "block" ? (
                    <Ban className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>
                <DialogHeader className="text-left">
                  <DialogTitle>
                    {confirmDialog.action === "approve"
                      ? "Approve Service"
                      : confirmDialog.action === "block"
                      ? "Block Service"
                      : "Unblock Service"}
                  </DialogTitle>
                  <DialogDescription>
                    {confirmDialog.action === "approve"
                      ? "This will make the service visible to users."
                      : confirmDialog.action === "block"
                      ? "This will hide the service from users."
                      : "This will make the service visible to users again."}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="text-sm text-muted-foreground">
                Are you sure you want to {confirmDialog.action} the service{" "}
                <span className="font-semibold text-foreground">"{confirmDialog.serviceTitle}"</span>?
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                  Cancel
                </Button>
                <Button
                  variant={confirmDialog.action === "block" ? "destructive" : "default"}
                  onClick={handleStatusChange}
                >
                  {confirmDialog.action === "approve"
                    ? "Approve Service"
                    : confirmDialog.action === "block"
                    ? "Block Service"
                    : "Unblock Service"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Services

