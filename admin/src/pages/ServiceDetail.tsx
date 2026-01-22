import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faStar } from "@fortawesome/free-solid-svg-icons"
import { faStar as faStarRegular, faStarHalfStroke } from "@fortawesome/free-regular-svg-icons"
import { serviceApi, Service } from "../services/api"
import ImageWithLoader from "../components/ImageWithLoader"
import { useDefaultServiceImageSrc } from "../hooks/use-default-service-image"
import { formatPaymentDuration, formatPaymentDurationSuffix } from "../utils/paymentDuration"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle,
  ClipboardList,
  MessageSquare,
  Tag,
  Trash2,
  User,
} from "lucide-react"

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
  action: "approve" | "block" | "unblock" | "delete"
  newStatus?: "draft" | "active" | "blocked"
}

function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const defaultServiceImageSrc = useDefaultServiceImageSrc()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedbacks, setFeedbacks] = useState<Service['feedbacks']>([])
  const [loadingMoreFeedbacks, setLoadingMoreFeedbacks] = useState(false)
  const [currentFeedbackPage, setCurrentFeedbackPage] = useState(1)
  const [feedbacksHasMore, setFeedbacksHasMore] = useState(false)

  useEffect(() => {
    if (id) {
      fetchService()
    }
  }, [id])

  const fetchService = async (feedbackPage: number = 1) => {
    try {
      setLoading(true)
      const data = await serviceApi.getById(id!, feedbackPage, 10)
      setService(data)
      setFeedbacks(data.feedbacks || [])
      setFeedbacksHasMore(data.feedbacksHasMore || false)
      setCurrentFeedbackPage(feedbackPage)
    } catch (error) {
      console.error("Failed to fetch service:", error)
      navigate("/services")
    } finally {
      setLoading(false)
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
      console.error("Failed to load more feedbacks:", error)
    } finally {
      setLoadingMoreFeedbacks(false)
    }
  }

  const handleAction = async () => {
    if (!confirmDialog || !service) return

    try {
      setActionLoading(true)
      if (confirmDialog.action === "delete") {
        await serviceApi.delete(service.id)
        navigate("/services")
      } else if (confirmDialog.newStatus) {
        await serviceApi.updateStatus(service.id, confirmDialog.newStatus)
        await fetchService()
      }
      setConfirmDialog(null)
    } catch (error) {
      console.error("Failed to perform action:", error)
      alert("Failed to perform action")
    } finally {
      setActionLoading(false)
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

  const getServiceRating = (value: Service["averageRating"] | Service["rating"]) => {
    if (value === undefined || value === null) return 0
    return typeof value === "number" ? value : parseFloat(String(value))
  }

  const getServicePrice = (value: Service["balance"]) => {
    const parsed = typeof value === "number" ? value : parseFloat(value as any)
    if (Number.isNaN(parsed)) return "0.00"
    return (Math.round(parsed * 100) / 100).toFixed(2)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading service</CardTitle>
            <CardDescription>Fetching service details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Service not found</CardTitle>
            <CardDescription>This service may have been removed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/services")}>Back to Services</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/services")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Service Details</h1>
            <p className="text-sm text-muted-foreground">Manage and review service information.</p>
          </div>
        </div>
        <Badge variant={getStatusBadgeVariant(service.status)} className="uppercase">
          {service.status}
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Approve, block, or remove this service.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {service.status === "draft" && (
              <Button onClick={() => setConfirmDialog({ action: "approve", newStatus: "active" })}>
                <Check className="h-4 w-4" />
                Approve
              </Button>
            )}
            {service.status === "active" && (
              <Button
                variant="destructive"
                onClick={() => setConfirmDialog({ action: "block", newStatus: "blocked" })}
              >
                <Ban className="h-4 w-4" />
                Block
              </Button>
            )}
            {service.status === "blocked" && (
              <Button
                variant="outline"
                onClick={() => setConfirmDialog({ action: "unblock", newStatus: "active" })}
              >
                <Check className="h-4 w-4" />
                Unblock
              </Button>
            )}
            <Button variant="destructive" onClick={() => setConfirmDialog({ action: "delete" })}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardContent className="flex min-h-[320px] items-center justify-center p-6">
            <ImageWithLoader
              src={service.adImage?.trim() ? service.adImage : defaultServiceImageSrc}
              alt={service.title}
              className="max-h-[360px] w-full object-contain"
              containerClassName="w-full h-full"
              showBlurBackground={true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            {service.category && (
              <Badge variant="secondary" className="w-fit">
                {service.category.title}
              </Badge>
            )}
            <CardTitle className="text-2xl">{service.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-3xl font-semibold text-foreground">
                  ${getServicePrice(service.balance)}
                  {formatPaymentDurationSuffix(service.paymentDuration)}
                </div>
                <div className="text-xs text-muted-foreground">Price</div>
              </div>
              <div className="flex items-center gap-2">
                <StarRating
                  rating={
                    service.averageRating !== undefined && service.averageRating > 0
                      ? getServiceRating(service.averageRating)
                      : getServiceRating(service.rating)
                  }
                />
                {service.averageRating !== undefined && service.averageRating > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({service.averageRating.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-xs text-muted-foreground">Payment</div>
                <div className="mt-2 text-lg font-semibold">
                  ${getServicePrice(service.balance)}
                  {formatPaymentDurationSuffix(service.paymentDuration)}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-xs text-muted-foreground">Payment duration</div>
                <div className="mt-2 text-lg font-semibold">{formatPaymentDuration(service.paymentDuration)}</div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="h-4 w-4" />
                Milestone statistics
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-md border bg-background p-3">
                  <div className="text-lg font-semibold">{service.totalMilestones ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Total milestones</div>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <div className="flex items-center gap-1 text-lg font-semibold text-foreground">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    {service.completedMilestones ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <div className="text-lg font-semibold">{service.feedbackCount ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Feedbacks</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">Description</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {service.adText || "No description provided."}
              </p>
            </div>

            {service.tags && service.tags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Tag className="h-4 w-4" />
                  Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {service.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {service.user && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <User className="h-4 w-4" />
                  Seller information
                </div>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {service.user.firstName?.[0] || service.user.userName?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold">
                      {service.user.firstName && service.user.lastName
                        ? `${service.user.firstName} ${service.user.lastName}`
                        : service.user.userName || "Anonymous"}
                    </div>
                    <div className="text-xs text-muted-foreground">{service.user.email || "N/A"}</div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Service ID: {service.id}</p>
              <p>Created: {new Date(service.createdAt).toLocaleString()}</p>
              <p>Last Updated: {new Date(service.updatedAt).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <CardTitle>Customer Feedbacks</CardTitle>
          </div>
          <Badge variant="secondary">Total: {service.feedbackCount ?? 0}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedbacks && feedbacks.length > 0 ? (
            <>
              {feedbacks.map((feedback) => (
                <Card key={feedback.id} className="bg-muted/30">
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {feedback.client.firstName?.[0] || feedback.client.userName?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-semibold">
                            {feedback.client.firstName && feedback.client.lastName
                              ? `${feedback.client.firstName} ${feedback.client.lastName}`
                              : feedback.client.userName || "Anonymous"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(feedback.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StarRating rating={feedback.rating} />
                        <span className="text-xs text-muted-foreground">({feedback.rating})</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">Milestone</div>
                      <div className="text-sm">{feedback.title}</div>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{feedback.feedback}</p>
                  </CardContent>
                </Card>
              ))}
              {feedbacksHasMore && (
                <div className="flex justify-center">
                  <Button onClick={loadMoreFeedbacks} disabled={loadingMoreFeedbacks}>
                    {loadingMoreFeedbacks && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loadingMoreFeedbacks ? "Loading..." : "Load More Feedbacks"}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No feedbacks yet.</div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(confirmDialog)}
        onOpenChange={(open) => {
          if (!open && !actionLoading) setConfirmDialog(null)
        }}
      >
        <DialogContent>
          {confirmDialog && (
            <>
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    confirmDialog.action === "delete"
                      ? "bg-destructive/10 text-destructive"
                      : confirmDialog.action === "block"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {confirmDialog.action === "delete" ? (
                    <Trash2 className="h-5 w-5" />
                  ) : confirmDialog.action === "block" ? (
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
                      : confirmDialog.action === "unblock"
                      ? "Unblock Service"
                      : "Delete Service"}
                  </DialogTitle>
                  <DialogDescription>
                    {confirmDialog.action === "approve"
                      ? "This will make the service visible to users."
                      : confirmDialog.action === "block"
                      ? "This will hide the service from users."
                      : confirmDialog.action === "unblock"
                      ? "This will make the service visible to users again."
                      : "This action cannot be undone."}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="text-sm text-muted-foreground">
                Are you sure you want to {confirmDialog.action} the service{" "}
                <span className="font-semibold text-foreground">"{service.title}"</span>?
                {confirmDialog.action === "delete" && (
                  <span className="mt-2 block text-xs text-destructive">
                    This will permanently delete the service.
                  </span>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={actionLoading}>
                  Cancel
                </Button>
                <Button
                  variant={confirmDialog.action === "delete" || confirmDialog.action === "block" ? "destructive" : "default"}
                  onClick={handleAction}
                  disabled={actionLoading}
                >
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {actionLoading
                    ? "Processing..."
                    : confirmDialog.action === "approve"
                    ? "Approve Service"
                    : confirmDialog.action === "block"
                    ? "Block Service"
                    : confirmDialog.action === "unblock"
                    ? "Unblock Service"
                    : "Delete Service"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ServiceDetail

