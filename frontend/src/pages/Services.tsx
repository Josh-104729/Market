import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppSelector } from '../store/hooks'
import { categoryApi, serviceApi, Service, Category } from '../services/api'
import { renderIcon } from '../utils/iconHelper'
import ImageWithLoader from '../components/ImageWithLoader'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Search, 
  Plus, 
  Star, 
  LayoutGrid, 
  Table as TableIcon, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Package,
  StarHalf
} from "lucide-react"

type ViewMode = 'card' | 'table'

const STORAGE_KEY = 'services_view_mode'

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
        <Star key={`empty-${i}`} className="w-3.5 h-3.5 text-slate-200" />
      ))}
    </div>
  )
}

function Services() {
  const { isAuthenticated } = useAppSelector((state) => state.auth)
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
  }, [searchTerm, selectedCategory, itemsPerPage])

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
        status: 'active',
        page: currentPage,
        limit: itemsPerPage,
      }
      if (selectedCategory && selectedCategory !== 'all') {
        params.categoryId = selectedCategory
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim()
      }
      const response = await serviceApi.getAllPaginated(params)
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Marketplace</h1>
            <p className="text-slate-500 mt-1">Discover and purchase services from our community.</p>
          </div>
          {isAuthenticated && (
            <Button asChild className="gap-2 rounded-full px-6 shadow-md shadow-primary/20">
              <Link to="/services/new">
                <Plus className="w-4 h-4" />
                <span>Create Service</span>
              </Link>
            </Button>
          )}
        </div>

        <Separator className="bg-slate-100" />

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-64 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Category</Label>
                <div className="flex flex-col gap-1">
                  <Button
                    variant={selectedCategory === 'all' ? "secondary" : "ghost"}
                    className="justify-between px-3 h-10 font-medium"
                    onClick={() => setSelectedCategory('all')}
                  >
                    <span>All Categories</span>
                    <Badge variant="outline" className="ml-2 font-bold text-[10px]">{totalServiceCount}</Badge>
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "secondary" : "ghost"}
                      className="justify-between px-3 h-10 font-medium"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {category.icon && <span className="text-primary">{renderIcon(category.icon, 'w-4 h-4')}</span>}
                        <span className="truncate">{category.title}</span>
                      </div>
                      {category.serviceCount !== undefined && (
                        <Badge variant="outline" className="ml-2 font-bold text-[10px]">{category.serviceCount}</Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            {/* Search and View Toggle */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search services..."
                  className="pl-10 h-11 rounded-xl bg-white border-slate-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-xl border border-slate-200">
                <Button
                  variant={viewMode === 'card' ? "white" : "ghost"}
                  size="icon"
                  className={`h-9 w-9 rounded-lg ${viewMode === 'card' ? "bg-white shadow-sm" : "text-slate-500"}`}
                  onClick={() => setViewMode('card')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? "white" : "ghost"}
                  size="icon"
                  className={`h-9 w-9 rounded-lg ${viewMode === 'table' ? "bg-white shadow-sm" : "text-slate-500"}`}
                  onClick={() => setViewMode('table')}
                >
                  <TableIcon className="w-4 h-4" />
                </Button>
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
              <Card className="border-dashed border-2 bg-slate-50/50 py-20">
                <CardContent className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                    <Package className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">No services found</h3>
                    <p className="text-slate-500 max-w-xs mx-auto">Try adjusting your filters or search terms to find what you're looking for.</p>
                  </div>
                  <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}>
                    Clear all filters
                  </Button>
                </CardContent>
              </Card>
            ) : viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {services.map((service) => (
                  <Card key={service.id} className="overflow-hidden group hover:border-primary/50 transition-all hover:shadow-md border-slate-200">
                    <Link to={`/services/${service.id}`}>
                      <div className="h-48 relative bg-slate-50 overflow-hidden">
                        {service.adImage ? (
                          <ImageWithLoader
                            src={service.adImage}
                            alt={service.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            containerClassName="w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Package className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-white/90 text-slate-900 hover:bg-white backdrop-blur-sm border-none shadow-sm font-bold">
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
                      <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">
                        {service.adText}
                      </p>
                    </CardContent>
                    <CardFooter className="p-5 pt-0 flex flex-wrap gap-1">
                      {service.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag.id} variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none px-2 py-0 h-5 text-[10px] font-medium">
                          #{tag.title}
                        </Badge>
                      ))}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50/50">
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
                          <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden relative border border-slate-200">
                            {service.adImage ? (
                              <ImageWithLoader
                                src={service.adImage}
                                alt={service.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900 group-hover:text-primary transition-colors">{service.title}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">{service.adText}</div>
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-900">{Math.min(currentPage * itemsPerPage, total)}</span> of <span className="font-semibold text-slate-900">{total}</span> services
                </p>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Prev</span>
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => 
                      p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)
                    ).map((p, i, arr) => (
                      <div key={p} className="flex items-center">
                        {i > 0 && arr[i-1] !== p - 1 && <span className="text-slate-300 px-1">...</span>}
                        <Button
                          variant={currentPage === p ? "default" : "ghost"}
                          size="sm"
                          className={`h-9 w-9 p-0 ${currentPage === p ? "shadow-md shadow-primary/20" : ""}`}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Services
