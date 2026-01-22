import { useEffect, useMemo, useState } from "react"
import { blogApi, Post, PostReport } from "../services/api"
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
import { Archive, Check, Search, Trash2, XCircle } from "lucide-react"

interface ConfirmDialog {
  postId: string
  postContent: string
  action: "approve" | "reject" | "archive" | "delete"
  newStatus?: Post["status"]
}

const POST_STATUS_LABELS = {
  pending: "Pending",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
}

function Blog() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [reports, setReports] = useState<PostReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportStatusFilter, setReportStatusFilter] = useState<"open" | "resolved" | "rejected" | "">("open")
  const [previewPost, setPreviewPost] = useState<Post | null>(null)
  const itemsPerPage = 10

  const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"
  const resolveImageUrl = (imagePath: string) => {
    try {
      return new URL(imagePath, BACKEND_BASE_URL).toString()
    } catch {
      return `${BACKEND_BASE_URL}${imagePath}`
    }
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, searchTerm])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPosts()
    }, searchTerm ? 500 : 0)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, searchTerm])

  useEffect(() => {
    fetchReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStatusFilter])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      }
      if (statusFilter) {
        params.status = statusFilter
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim()
      }
      const response = await blogApi.getAll(params)
      setPosts(response.data)
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (error) {
      console.error("Failed to fetch posts:", error)
      alert("Failed to load posts")
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async () => {
    try {
      setReportsLoading(true)
      const response = await blogApi.getReports({
        status: reportStatusFilter || undefined,
        page: 1,
        limit: 10,
      })
      setReports(response.data)
    } catch (error) {
      console.error("Failed to fetch reports:", error)
      alert("Failed to load reports")
    } finally {
      setReportsLoading(false)
    }
  }

  const handleStatusChangeClick = (
    id: string,
    content: string,
    action: ConfirmDialog["action"],
    newStatus?: Post["status"]
  ) => {
    setConfirmDialog({
      postId: id,
      postContent: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
      action,
      newStatus,
    })
  }

  const handleStatusChange = async () => {
    if (!confirmDialog) return

    try {
      if (confirmDialog.action === "delete") {
        await blogApi.delete(confirmDialog.postId)
      } else if (confirmDialog.newStatus) {
        await blogApi.updateStatus(confirmDialog.postId, confirmDialog.newStatus)
      }
      setConfirmDialog(null)
      fetchPosts()
    } catch (error) {
      console.error("Failed to update post:", error)
      alert("Failed to update post")
      setConfirmDialog(null)
    }
  }

  const handlePreviewPost = (post: Post) => {
    setPreviewPost(post)
  }

  const handleReportStatus = async (id: string, status: PostReport["status"]) => {
    try {
      await blogApi.updateReportStatus(id, status)
      fetchReports()
    } catch (error) {
      console.error("Failed to update report:", error)
      alert("Failed to update report")
    }
  }

  const getPostStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "published":
        return "default"
      case "pending":
        return "secondary"
      case "rejected":
        return "destructive"
      case "archived":
        return "outline"
      default:
        return "outline"
    }
  }

  const getReportStatusVariant = (
    status: PostReport["status"]
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "open":
        return "secondary"
      case "resolved":
        return "default"
      case "rejected":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getUserName = (post: Post) => {
    if (post.user?.userName) return post.user.userName
    if (post.user?.firstName || post.user?.lastName) {
      return `${post.user.firstName || ""} ${post.user.lastName || ""}`.trim()
    }
    return post.user?.email || "Anonymous"
  }

  const getReporterName = (report: PostReport) => {
    const user = report.user
    if (!user) return "Unknown"
    if (user.userName) return user.userName
    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim()
    }
    return user.email || "Unknown"
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
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

  const dialogMeta = useMemo(() => {
    if (!confirmDialog) return null

    switch (confirmDialog.action) {
      case "delete":
        return {
          title: "Delete Post",
          description: "This action cannot be undone.",
          confirmLabel: "Delete Post",
          icon: Trash2,
          variant: "destructive" as const,
        }
      case "archive":
        return {
          title: "Archive Post",
          description: "This will hide the post from the feed.",
          confirmLabel: "Archive Post",
          icon: Archive,
          variant: "secondary" as const,
        }
      case "reject":
        return {
          title: "Reject Post",
          description: "This will mark the post as rejected and hide it from users.",
          confirmLabel: "Reject Post",
          icon: XCircle,
          variant: "destructive" as const,
        }
      default:
        return {
          title: "Approve Post",
          description: "This will make the post visible to users.",
          confirmLabel: "Approve Post",
          icon: Check,
          variant: "default" as const,
        }
    }
  }, [confirmDialog])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Blog Management</h1>
          <p className="text-sm text-muted-foreground">Review and manage all blog posts.</p>
        </div>
        <Badge variant="secondary">Total posts: {total}</Badge>
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search by content or author.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search posts..."
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Post Reports</CardTitle>
            <CardDescription>Review and take action on user reports.</CardDescription>
          </div>
          <Select
            value={reportStatusFilter || "all"}
            onValueChange={(value) => setReportStatusFilter(value === "all" ? "" : (value as any))}
          >
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder="Report status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports found for this filter.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reason</TableHead>
                    <TableHead>Post</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium text-foreground">{report.reason}</TableCell>
                      <TableCell className="max-w-[260px]">
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {report.post?.content ? report.post.content : "Unknown post"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground">{getReporterName(report)}</div>
                        {report.user?.email && (
                          <div className="text-xs text-muted-foreground">{report.user.email}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getReportStatusVariant(report.status)}>{report.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(report.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {report.status === "open" ? (
                            <>
                              <Button size="sm" onClick={() => handleReportStatus(report.id, "resolved")}>
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReportStatus(report.id, "rejected")}
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => handleReportStatus(report.id, "open")}>
                              Reopen
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

      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
          <CardDescription>Approve, reject, or archive user posts.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts found.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id} onClick={() => handlePreviewPost(post)} className="cursor-pointer">
                      <TableCell className="min-w-[320px]">
                        <div className="flex items-start gap-3">
                          {post.images && post.images.length > 0 ? (
                            <img
                              src={resolveImageUrl(post.images[0])}
                              alt="Post"
                              className="h-16 w-16 rounded-md object-cover"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-md bg-muted" />
                          )}
                          <div className="space-y-1">
                            <p className="line-clamp-2 text-sm font-medium text-foreground">{post.content}</p>
                            <p className="text-xs text-muted-foreground">
                              {post.images && post.images.length > 0
                                ? `${post.images.length} image${post.images.length > 1 ? "s" : ""}`
                                : "No images"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-foreground">{getUserName(post)}</div>
                        {post.user?.email && <div className="text-xs text-muted-foreground">{post.user.email}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPostStatusVariant(post.status)}>
                          {POST_STATUS_LABELS[post.status as keyof typeof POST_STATUS_LABELS] || post.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          ❤️ {post.likeCount ?? 0} · 💬 {post.commentCount ?? 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(post.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {post.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleStatusChangeClick(post.id, post.content, "approve", "published")
                                }}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleStatusChangeClick(post.id, post.content, "reject", "rejected")
                                }}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </>
                          )}
                          {post.status === "published" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleStatusChangeClick(post.id, post.content, "archive", "archived")
                              }}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </Button>
                          )}
                          {(post.status === "archived" || post.status === "rejected") && (
                            <Button
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleStatusChangeClick(post.id, post.content, "approve", "published")
                              }}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Publish
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleStatusChangeClick(post.id, post.content, "delete")
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
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

      {!loading && total > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {total} posts
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
          {confirmDialog && dialogMeta && (
            <>
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    dialogMeta.variant === "destructive"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <dialogMeta.icon className="h-5 w-5" />
                </div>
                <DialogHeader className="text-left">
                  <DialogTitle>{dialogMeta.title}</DialogTitle>
                  <DialogDescription>{dialogMeta.description}</DialogDescription>
                </DialogHeader>
              </div>
              <div className="text-sm text-muted-foreground">
                Are you sure you want to {confirmDialog.action} the post{" "}
                <span className="font-semibold text-foreground">"{confirmDialog.postContent}"</span>?
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                  Cancel
                </Button>
                <Button variant={dialogMeta.variant} onClick={handleStatusChange}>
                  {dialogMeta.confirmLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewPost)}
        onOpenChange={(open) => {
          if (!open) setPreviewPost(null)
        }}
      >
        <DialogContent className="max-w-3xl">
          {previewPost && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle>Post details</DialogTitle>
                <DialogDescription>Full content and attachments.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={getPostStatusVariant(previewPost.status)}>
                    {POST_STATUS_LABELS[previewPost.status as keyof typeof POST_STATUS_LABELS] || previewPost.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(previewPost.createdAt)} · {getUserName(previewPost)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">{previewPost.content}</p>
                {previewPost.images && previewPost.images.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {previewPost.images.map((image, index) => (
                      <img
                        key={`${previewPost.id}-${index}`}
                        src={resolveImageUrl(image)}
                        alt={`Post image ${index + 1}`}
                        className="h-48 w-full rounded-md object-cover"
                      />
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewPost(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default Blog

