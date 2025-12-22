import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../store/hooks'
import { categoryApi, serviceApi, Service, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'
import ImageWithLoader from '../components/ImageWithLoader'
import { showToast } from "../utils/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { 
  Search, 
  Plus, 
  Star, 
  LayoutGrid, 
  Table as TableIcon, 
  Filter,
  Package,
  StarHalf
} from "lucide-react"

type ViewMode = 'card' | 'table'
type ServicesScope = "all" | "my"

const STORAGE_KEY = 'services_view_mode'

type PaginationToken = number | "ellipsis"

function getPaginationTokens(currentPage: number, totalPages: number, siblingCount = 1): PaginationToken[] {
  const totalPageNumbers = siblingCount * 2 + 5

  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages)

  const shouldShowLeftEllipsis = leftSiblingIndex > 2
  const shouldShowRightEllipsis = rightSiblingIndex < totalPages - 1

  const firstPageIndex = 1
  const lastPageIndex = totalPages

  if (!shouldShowLeftEllipsis && shouldShowRightEllipsis) {
    const leftItemCount = 3 + 2 * siblingCount
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1)
    return [...leftRange, "ellipsis", lastPageIndex]
  }

  if (shouldShowLeftEllipsis && !shouldShowRightEllipsis) {
    const rightItemCount = 3 + 2 * siblingCount
    const start = totalPages - rightItemCount + 1
    const rightRange = Array.from({ length: rightItemCount }, (_, i) => start + i)
    return [firstPageIndex, "ellipsis", ...rightRange]
  }

  const middleRange = Array.from(
    { length: rightSiblingIndex - leftSiblingIndex + 1 },
    (_, i) => leftSiblingIndex + i
  )
  return [firstPageIndex, "ellipsis", ...middleRange, "ellipsis", lastPageIndex]
}

const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
      ))}
      {hasHalfStar && <StarHalf className="w-3.5 h-3.5 text-yellow-400" />}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className="w-3.5 h-3.5 text-muted-foreground/30" />
      ))}
    </div>
  )
}

function Services() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [scope, setScope] = useState<ServicesScope>("all")
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return (saved === 'card' || saved === 'table') ? saved : 'card'
  })

  const totalServiceCount = categories.reduce((sum, category) => sum + (category.serviceCount || 0), 0)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode)
  }, [viewMode])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedCategory, itemsPerPage, scope])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchServices()
    }, searchTerm ? 500 : 0)
    return () => clearTimeout(timeoutId)
  }, [currentPage, searchTerm, selectedCategory, itemsPerPage])

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.getAll()
      setCategories(data)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchServices = async () => {
    try {
      setLoading(true)
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      }
      // Only show active services in public marketplace.
      if (scope === "all") {
        params.status = 'active'
      }
      if (selectedCategory && selectedCategory !== 'all') {
        params.categoryId = selectedCategory
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim()
      }
      const response =
        scope === "my"
          ? await serviceApi.getMyServices(params)
          : await serviceApi.getAllPaginated(params)
      setServices(response.data)
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (error) {
      console.error('Failed to fetch services:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 py-4">
        {/* Tabs row */}
        <div className="flex items-center justify-between gap-4">
          <Tabs
            value={scope}
            onValueChange={(v) => {
              if (v !== "all" && v !== "my") return
              if (v === "my" && !isAuthenticated) {
                showToast.info("Please sign in to view your services.")
                navigate("/signin")
                return
              }
              setScope(v)
            }}
          >
            <TabsList>
              <TabsTrigger value="all">All Services</TabsTrigger>
              <TabsTrigger value="my" disabled={!isAuthenticated}>
                My Services
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {isAuthenticated && (
            <Button asChild className="gap-2 rounded-full px-6">
              <Link to="/services/new">
                <Plus className="w-4 h-4" />
                <span>Create Service</span>
              </Link>
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-64 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </CardTitle>
                <CardDescription>Refine your search</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Category
                  </Label>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant={selectedCategory === 'all' ? "secondary" : "ghost"}
                      className="justify-between px-3 h-10 font-medium"
                      onClick={() => setSelectedCategory('all')}
                    >
                      <span>All Categories</span>
                      {scope === "all" ? (
                        <Badge variant="outline" className="ml-2 font-bold text-[10px]">
                          {totalServiceCount}
                        </Badge>
                      ) : null}
                    </Button>
                    {categories.map((category) => (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? "secondary" : "ghost"}
                        className="justify-between px-3 h-10 font-medium"
                        onClick={() => setSelectedCategory(category.id)}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {category.icon && (
                            <span className="text-primary">
                              {renderIcon(category.icon, 'w-4 h-4')}
                            </span>
                          )}
                          <span className="truncate">{category.title}</span>
                        </div>
                        {scope === "all" && category.serviceCount !== undefined && (
                          <Badge variant="outline" className="ml-2 font-bold text-[10px]">
                            {category.serviceCount}
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            {/* Search and View Toggle */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search services..."
                  className="pl-10 h-11"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                  <SelectTrigger className="h-11 w-full sm:w-[150px]">
                    <SelectValue placeholder="Per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 / page</SelectItem>
                    <SelectItem value="24">24 / page</SelectItem>
                    <SelectItem value="48">48 / page</SelectItem>
                  </SelectContent>
                </Select>

              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => {
                  if (v === "card" || v === "table") setViewMode(v)
                }}
                className="justify-end"
              >
                <ToggleGroupItem value="card" aria-label="Card view">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view">
                  <TableIcon className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              </div>
            </div>

            {/* Results */}
            {loading ? (
              <div className={viewMode === 'card' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" : "space-y-4"}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-48 w-full rounded-2xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : services.length === 0 ? (
              <Card className="border-dashed border-2 bg-muted/20 py-20">
                <CardContent className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                    <Package className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">No services found</h3>
                    <p className="text-muted-foreground max-w-xs mx-auto">Try adjusting your filters or search terms to find what you're looking for.</p>
                  </div>
                  <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}>
                    Clear all filters
                  </Button>
                </CardContent>
              </Card>
            ) : viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {services.map((service) => (
                  <Card key={service.id} className="overflow-hidden group hover:border-primary/50 transition-all hover:shadow-md">
                    <Link to={`/services/${service.id}`}>
                      <div className="h-48 relative bg-muted/20 overflow-hidden">
                        {service.adImage ? (
                          <ImageWithLoader
                            src={service.adImage}
                            alt={service.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            containerClassName="w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                            <Package className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          <Badge variant="secondary" className="backdrop-blur-sm shadow-sm font-bold">
                            ${typeof service.balance === 'number' ? service.balance.toFixed(2) : parseFloat(service.balance as any).toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                    <CardHeader className="p-5 pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          {service.category?.title || 'Uncategorized'}
                        </span>
                        <StarRating rating={service.averageRating || service.rating || 0} />
                      </div>
                      <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">
                        <Link to={`/services/${service.id}`}>{service.title}</Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">
                        {service.adText}
                      </p>
                    </CardContent>
                    <CardFooter className="p-5 pt-0 flex flex-wrap gap-1">
                      {service.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag.id} variant="secondary" className="px-2 py-0 h-5 text-[10px] font-medium">
                          #{tag.title}
                        </Badge>
                      ))}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[80px]">Image</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service) => (
                      <TableRow key={service.id} className="group cursor-pointer" onClick={() => navigate(`/services/${service.id}`)}>
                        <TableCell>
                          <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden relative border border-border">
                            {service.adImage ? (
                              <ImageWithLoader
                                src={service.adImage}
                                alt={service.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{service.title}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{service.adText}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium text-[10px]">{service.category?.title || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <StarRating rating={service.averageRating || service.rating || 0} />
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          ${typeof service.balance === 'number' ? service.balance.toFixed(2) : parseFloat(service.balance as any).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">{Math.min(currentPage * itemsPerPage, total)}</span>{" "}
                  of{" "}
                  <span className="font-semibold text-foreground">{total}</span> services
                </p>

                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }}
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>

                    {getPaginationTokens(currentPage, totalPages).map((token, idx) => {
                      if (token === "ellipsis") {
                        return (
                          <PaginationItem key={`ellipsis-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )
                      }
                      return (
                        <PaginationItem key={token}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === token}
                            onClick={(e) => {
                              e.preventDefault()
                              setCurrentPage(token)
                            }}
                          >
                            {token}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                        }}
                        aria-disabled={currentPage === totalPages}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}

export default Services
