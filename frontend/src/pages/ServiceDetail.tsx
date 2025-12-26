import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { categoryApi, serviceApi, Service, conversationApi, Conversation, Category } from '../services/api'
import { useAppSelector } from '../store/hooks'
import ImageWithLoader from '../components/ImageWithLoader'
import { useDefaultServiceImageSrc } from '../hooks/use-default-service-image'
import { formatPaymentDuration, formatPaymentDurationSuffix } from '../utils/paymentDuration'
import { showToast } from '../utils/toast'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  Star,
  StarHalf,
  UploadCloud,
  User,
  X,
} from "lucide-react"

const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      ))}
      {hasHalfStar && <StarHalf className="w-4 h-4 text-yellow-400" />}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className="w-4 h-4 text-muted-foreground/30" />
      ))}
    </div>
  )
}

function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultServiceImageSrc = useDefaultServiceImageSrc()
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [connectedClients, setConnectedClients] = useState<Conversation[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [feedbacks, setFeedbacks] = useState<Service['feedbacks']>([])
  const [loadingMoreFeedbacks, setLoadingMoreFeedbacks] = useState(false)
  const [currentFeedbackPage, setCurrentFeedbackPage] = useState(1)
  const [feedbacksHasMore, setFeedbacksHasMore] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [editForm, setEditForm] = useState({
    categoryId: '',
    title: '',
    adText: '',
    balance: '',
    paymentDuration: 'each_time' as 'hourly' | 'daily' | 'weekly' | 'monthly' | 'each_time',
    tags: [] as string[],
  })
  const [tagInput, setTagInput] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const isProvider = !!(service && user && isAuthenticated && service.userId === user.id)

  useEffect(() => {
    if (id) {
      fetchService()
    }
  }, [id])

  useEffect(() => {
    // Auto-open edit mode when coming from My Services (/?edit=1)
    if (service && isProvider && searchParams.get('edit') === '1' && !isEditing) {
      startEdit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, isProvider, searchParams])

  useEffect(() => {
    if (service && user && isAuthenticated) {
      if (isProvider) {
        fetchConnectedClients()
      }
    }
  }, [service, user, isAuthenticated])

  const fetchService = async (feedbackPage: number = 1) => {
    try {
      if (feedbackPage === 1) setLoading(true)
      const data = await serviceApi.getById(id!, feedbackPage, 10)
      setService(data)
      setFeedbacks(data.feedbacks || [])
      setFeedbacksHasMore(data.feedbacksHasMore || false)
      setCurrentFeedbackPage(feedbackPage)
    } catch (error) {
      console.error('Failed to fetch service:', error)
      navigate('/services')
    } finally {
      if (feedbackPage === 1) setLoading(false)
    }
  }

  const loadMoreFeedbacks = async () => {
    if (!id || loadingMoreFeedbacks || !feedbacksHasMore) return

    try {
      setLoadingMoreFeedbacks(true)
      const nextPage = currentFeedbackPage + 1
      const data = await serviceApi.getById(id, nextPage, 10)
      if (data.feedbacks) {
        setFeedbacks((prev) => [...(prev || []), ...data.feedbacks!])
        setFeedbacksHasMore(data.feedbacksHasMore || false)
        setCurrentFeedbackPage(nextPage)
      }
    } catch (error) {
      console.error('Failed to load more feedbacks:', error)
    } finally {
      setLoadingMoreFeedbacks(false)
    }
  }

  const fetchConnectedClients = async () => {
    if (!service || !user) {
      console.log('Cannot fetch clients: missing service or user', { service: !!service, user: !!user })
      return
    }

    // Double check that user is the provider
    if (service.userId !== user.id) {
      console.log('User is not the provider, skipping fetch', { serviceUserId: service.userId, userId: user.id })
      return
    }

    try {
      setLoadingClients(true)
      console.log('Fetching connected clients for service:', service.id)
      const conversations = await conversationApi.getByServiceIdAsProvider(service.id)
      console.log('Fetched connected clients:', conversations)
      setConnectedClients(Array.isArray(conversations) ? conversations : [])
    } catch (error: any) {
      console.error('Failed to fetch connected clients:', error)
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.data)
        if (error.response.status === 403) {
          console.log('User is not the provider of this service')
        } else if (error.response.status === 404) {
          console.log('Service not found')
        }
      } else if (error.request) {
        console.error('No response received:', error.request)
      } else {
        console.error('Error setting up request:', error.message)
      }
      setConnectedClients([])
    } finally {
      setLoadingClients(false)
    }
  }

  const handleConnectSeller = async () => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    if (!service) return

    try {
      setConnecting(true)
      const conversation = await conversationApi.create(service.id)
      navigate(`/chat/${conversation.id}`)
    } catch (error: any) {
      console.error('Failed to connect with seller:', error)
      if (error.response?.status === 403) {
        showToast.error('You cannot connect with yourself')
      } else {
        showToast.error('Failed to connect with seller. Please try again.')
      }
    } finally {
      setConnecting(false)
    }
  }

  const handleClientClick = (conversationId: string) => {
    navigate(`/chat/${conversationId}`)
  }

  const ratingValue = useMemo(() => {
    if (!service) return 0
    const v =
      service.averageRating !== undefined
        ? service.averageRating
        : service.rating
          ? typeof service.rating === "number"
            ? service.rating
            : parseFloat(service.rating as any)
          : 0
    return Number.isFinite(v) ? v : 0
  }, [service])

  const priceValue = useMemo(() => {
    if (!service) return 0
    const v =
      typeof service.balance === "number"
        ? service.balance
        : parseFloat(service.balance as any)
    return Number.isFinite(v) ? v : 0
  }, [service])
  const fetchCategories = async () => {
    try {
      const data = await categoryApi.getAll()
      setCategories(data)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const startEdit = async () => {
    if (!service) return
    if (categories.length === 0) {
      await fetchCategories()
    }
    setEditErrors({})
    setEditImageFile(null)
    setEditImagePreview(null)
    setTagInput('')
    setEditForm({
      categoryId: service.categoryId || service.category?.id || '',
      title: service.title || '',
      adText: service.adText || '',
      balance: (typeof service.balance === 'number' ? service.balance : parseFloat(service.balance as any) || 0).toString(),
      paymentDuration: (service.paymentDuration || 'each_time') as any,
      tags: (service.tags || []).map((t) => t.title),
    })
    setIsEditing(true)
    // Ensure URL reflects edit state
    const next = new URLSearchParams(searchParams)
    next.set('edit', '1')
    setSearchParams(next, { replace: true })
  }

  const stopEdit = () => {
    setIsEditing(false)
    setEditSubmitting(false)
    setEditErrors({})
    setEditImageFile(null)
    setEditImagePreview(null)
    if (editFileInputRef.current) editFileInputRef.current.value = ''
    const next = new URLSearchParams(searchParams)
    next.delete('edit')
    setSearchParams(next, { replace: true })
  }

  const setEditImageFromFile = (file?: File) => {
    setEditErrors((prev) => ({ ...prev, image: '' }))
    setEditImageFile(null)
    setEditImagePreview(null)
    if (!file) return

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setEditErrors((prev) => ({ ...prev, image: 'Only JPG, PNG, GIF, or WEBP image files are allowed' }))
      if (editFileInputRef.current) editFileInputRef.current.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setEditErrors((prev) => ({ ...prev, image: 'Image size must be less than 5MB' }))
      if (editFileInputRef.current) editFileInputRef.current.value = ''
      return
    }

    setEditImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setEditImagePreview(reader.result as string)
    reader.onerror = () => {
      setEditErrors((prev) => ({ ...prev, image: 'Failed to load image preview' }))
      setEditImageFile(null)
      if (editFileInputRef.current) editFileInputRef.current.value = ''
    }
    reader.readAsDataURL(file)
  }

  const handleAddTag = () => {
    const t = tagInput.trim()
    if (!t) return
    if (editForm.tags.includes(t)) return
    setEditForm((prev) => ({ ...prev, tags: [...prev.tags, t] }))
    setTagInput('')
  }

  const handleRemoveTag = (t: string) => {
    setEditForm((prev) => ({ ...prev, tags: prev.tags.filter((x) => x !== t) }))
  }

  const handleSaveEdit = async () => {
    if (!service || !id) return

    const newErrors: Record<string, string> = {}
    if (!editForm.title.trim()) newErrors.title = 'Title is required'
    if (!editForm.adText.trim()) newErrors.adText = 'Description is required'
    const balanceValue = parseFloat(editForm.balance)
    if (!editForm.balance || Number.isNaN(balanceValue) || balanceValue <= 0) {
      newErrors.balance = 'Price must be greater than 0'
    }
    if (!editForm.paymentDuration) newErrors.paymentDuration = 'Payment duration is required'

    if (Object.keys(newErrors).length > 0) {
      setEditErrors(newErrors)
      return
    }

    try {
      setEditSubmitting(true)
      const updated = await serviceApi.update(
        id,
        {
          categoryId: editForm.categoryId || undefined,
          title: editForm.title.trim(),
          adText: editForm.adText.trim(),
          balance: Math.round(balanceValue * 100) / 100,
          paymentDuration: editForm.paymentDuration,
          tags: editForm.tags,
        },
        editImageFile || undefined,
      )
      setService(updated)
      showToast.success('Service updated')
      stopEdit()
    } catch (error: any) {
      console.error('Failed to update service:', error)
      const msg = error.response?.data?.message || 'Failed to update service'
      showToast.error(msg)
    } finally {
      setEditSubmitting(false)
    }
  }

  if (!service) {
    return (
      <div className="py-4 space-y-4">
        <Button variant="ghost" className="gap-2" onClick={() => navigate('/services')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Services
        </Button>
        <Alert>
          <Package className="h-4 w-4" />
          <AlertTitle>Service not found</AlertTitle>
          <AlertDescription>
            The service you're looking for may have been removed.
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link to="/services">Browse Marketplace</Link>
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-4 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[420px] w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" className="gap-2" onClick={() => navigate('/services')}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {service.category && (
          <Badge variant="outline" className="text-xs">
            {service.category.title}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative min-h-[360px] bg-muted/20 flex items-center justify-center">
              <ImageWithLoader
                src={service.adImage?.trim() ? service.adImage : defaultServiceImageSrc}
                alt={service.title}
                className="w-full h-full object-cover"
                containerClassName="w-full h-full"
                showBlurBackground={true}
              />
              <div className="absolute top-4 right-4">
                <Badge className="text-base font-bold px-3 py-1">
                  ${priceValue.toFixed(2)}{formatPaymentDurationSuffix(service.paymentDuration)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{service.title}</h1>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StarRating rating={ratingValue} />
                <span className="text-sm text-muted-foreground">
                  {ratingValue > 0 ? ratingValue.toFixed(2) : "No ratings"}
                  {service.feedbackCount ? ` • ${service.feedbackCount} reviews` : ""}
                </span>
              </div>
              <Badge variant={service.status === "active" ? "secondary" : "outline"}>
                {service.status}
              </Badge>
            </div>
            {isProvider && !isEditing ? (
              <div className="pt-2">
                <Button variant="outline" className="gap-2" onClick={startEdit}>
                  <Pencil className="h-4 w-4" />
                  Edit service
                </Button>
              </div>
            ) : null}
          </div>

          {isProvider && isEditing ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Edit service</CardTitle>
                <CardDescription>Update your listing details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={editForm.categoryId}
                      onValueChange={(value) => setEditForm((prev) => ({ ...prev, categoryId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Payment duration <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={editForm.paymentDuration}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({ ...prev, paymentDuration: value as any }))
                      }
                    >
                      <SelectTrigger className={editErrors.paymentDuration ? "border-destructive" : undefined}>
                        <SelectValue placeholder="Select payment duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="each_time">Each time</SelectItem>
                      </SelectContent>
                    </Select>
                    {editErrors.paymentDuration ? (
                      <p className="text-xs text-destructive">{editErrors.paymentDuration}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => {
                      const v = e.target.value
                      setEditForm((prev) => ({ ...prev, title: v }))
                      setEditErrors((prev) => ({ ...prev, title: "" }))
                    }}
                    className={editErrors.title ? "border-destructive" : undefined}
                  />
                  {editErrors.title ? <p className="text-xs text-destructive">{editErrors.title}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label>
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={editForm.adText}
                    onChange={(e) => {
                      const v = e.target.value
                      setEditForm((prev) => ({ ...prev, adText: v }))
                      setEditErrors((prev) => ({ ...prev, adText: "" }))
                    }}
                    className={editErrors.adText ? "border-destructive" : undefined}
                    rows={6}
                  />
                  {editErrors.adText ? <p className="text-xs text-destructive">{editErrors.adText}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label>
                    Payment <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={editForm.balance}
                    onChange={(e) => {
                      setEditForm((prev) => ({ ...prev, balance: e.target.value }))
                      setEditErrors((prev) => ({ ...prev, balance: "" }))
                    }}
                    className={editErrors.balance ? "border-destructive" : undefined}
                    placeholder="0.00"
                  />
                  {editErrors.balance ? <p className="text-xs text-destructive">{editErrors.balance}</p> : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Service image</Label>
                    {editImagePreview ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setEditImageFile(null)
                          setEditImagePreview(null)
                          setEditErrors((prev) => ({ ...prev, image: "" }))
                          if (editFileInputRef.current) editFileInputRef.current.value = ""
                        }}
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>

                  <div className="rounded-lg border p-3">
                    <img
                      src={editImagePreview || (service.adImage?.trim() ? service.adImage : defaultServiceImageSrc)}
                      alt="Service image preview"
                      className="max-h-56 w-full rounded-md object-contain"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      onClick={() => editFileInputRef.current?.click()}
                    >
                      <UploadCloud className="h-4 w-4" />
                      Choose image
                    </Button>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={(e) => setEditImageFromFile(e.target.files?.[0])}
                    />
                  </div>
                  {editErrors.image ? <p className="text-xs text-destructive">{editErrors.image}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
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
                      placeholder="Enter a tag and press Enter"
                    />
                    <Button type="button" variant="secondary" className="shrink-0 gap-2" onClick={handleAddTag}>
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  {editForm.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {editForm.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="gap-1">
                          <span className="max-w-[220px] truncate">#{t}</span>
                          <button
                            type="button"
                            className="ml-1 inline-flex items-center"
                            onClick={() => handleRemoveTag(t)}
                            aria-label={`Remove tag ${t}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No tags yet.</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={stopEdit} disabled={editSubmitting}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveEdit} disabled={editSubmitting} className="gap-2">
                  {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editSubmitting ? "Saving..." : "Save changes"}
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">About this service</CardTitle>
              <CardDescription>Overview, milestones, and provider details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ClipboardList className="h-4 w-4" /> Milestones
                  </div>
                  <div className="mt-1 text-xl font-bold">{service.totalMilestones ?? 0}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" /> Completed
                  </div>
                  <div className="mt-1 text-xl font-bold">{service.completedMilestones ?? 0}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MessageSquare className="h-4 w-4" /> Feedbacks
                  </div>
                  <div className="mt-1 text-xl font-bold">{service.feedbackCount ?? 0}</div>
                </div>
              </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">Payment</div>
                    <div className="mt-1 text-xl font-bold text-primary">
                      ${priceValue.toFixed(2)}{formatPaymentDurationSuffix(service.paymentDuration)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">Payment duration</div>
                    <div className="mt-1 text-xl font-bold">{formatPaymentDuration(service.paymentDuration)}</div>
                  </div>
                </div>

              <Separator />

              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Description</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {service.adText}
                </p>
              </div>

              {service.tags?.length ? (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Tags</h2>
                  <div className="flex flex-wrap gap-2">
                    {service.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary">
                        #{tag.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              {!isProvider ? (
                <Button onClick={handleConnectSeller} disabled={connecting} className="w-full gap-2">
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  Connect seller
                </Button>
              ) : (
                <Button variant="secondary" disabled className="w-full gap-2">
                  <MessageSquare className="h-4 w-4" />
                  You own this service
                </Button>
              )}
              {!isAuthenticated && (
                <p className="text-xs text-muted-foreground text-center">
                  Sign in to start a conversation with the seller.
                </p>
              )}
            </CardFooter>
          </Card>

          {service.user && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Seller</CardTitle>
                <CardDescription>Service provider</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Avatar className="h-10 w-10 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {(service.user.firstName?.[0] || service.user.userName?.[0] || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {service.user.firstName && service.user.lastName
                      ? `${service.user.firstName} ${service.user.lastName}`
                      : service.user.userName || "Anonymous"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> Provider
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Tabs defaultValue="feedback" className="w-full">
        <TabsList>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          {isProvider && <TabsTrigger value="clients">Clients</TabsTrigger>}
          <TabsTrigger value="meta">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer feedback</CardTitle>
              <CardDescription>
                {service.feedbackCount ? `${service.feedbackCount} reviews` : "No reviews yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {feedbacks && feedbacks.length > 0 ? (
                <div className="space-y-3">
                  {feedbacks.map((feedback) => (
                    <div key={feedback.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9 rounded-lg">
                            <AvatarFallback className="rounded-lg">
                              {(feedback.client.firstName?.[0] || feedback.client.userName?.[0] || "U").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">
                              {feedback.client.firstName && feedback.client.lastName
                                ? `${feedback.client.firstName} ${feedback.client.lastName}`
                                : feedback.client.userName || "Anonymous"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(feedback.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StarRating rating={feedback.rating} />
                          <span className="text-xs text-muted-foreground">({feedback.rating})</span>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Milestone: <span className="text-foreground font-medium">{feedback.title}</span>
                        </p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {feedback.feedback}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <MessageSquare className="h-4 w-4" />
                  <AlertTitle>No feedback yet</AlertTitle>
                  <AlertDescription>Be the first to leave a review after completing a milestone.</AlertDescription>
                </Alert>
              )}
            </CardContent>
            {feedbacksHasMore && (
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={loadMoreFeedbacks}
                  disabled={loadingMoreFeedbacks}
                >
                  {loadingMoreFeedbacks && <Loader2 className="h-4 w-4 animate-spin" />}
                  Load more feedback
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        {isProvider && (
          <TabsContent value="clients" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Connected clients
                  {loadingClients && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </CardTitle>
                <CardDescription>People who started a conversation about this service</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingClients ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : connectedClients.length === 0 ? (
                  <Alert>
                    <User className="h-4 w-4" />
                    <AlertTitle>No clients yet</AlertTitle>
                    <AlertDescription>When someone connects, they’ll appear here.</AlertDescription>
                  </Alert>
                ) : (
                  <ScrollArea className="h-[320px] pr-2">
                    <div className="space-y-2">
                      {connectedClients.map((conversation) => {
                        const client = conversation.client
                        const lastMessage =
                          conversation.messages && conversation.messages.length > 0
                            ? conversation.messages[0]
                            : null
                        const clientName =
                          client?.firstName && client?.lastName
                            ? `${client.firstName} ${client.lastName}`
                            : client?.userName || "Anonymous"

                        return (
                          <Button
                            key={conversation.id}
                            variant="outline"
                            className="w-full justify-between h-auto py-3"
                            onClick={() => handleClientClick(conversation.id)}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-9 w-9 rounded-lg">
                                <AvatarFallback className="rounded-lg">
                                  {(client?.firstName?.[0] || client?.userName?.[0] || "U").toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 text-left">
                                <p className="font-semibold truncate">{clientName}</p>
                                {lastMessage && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[420px]">
                                    {lastMessage.message}
                                  </p>
                                )}
                              </div>
                            </div>
                            {lastMessage && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </Button>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="meta" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Service details</CardTitle>
              <CardDescription>Metadata</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Service ID</span>
                <span className="font-mono text-xs">{service.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(service.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{new Date(service.updatedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ServiceDetail

