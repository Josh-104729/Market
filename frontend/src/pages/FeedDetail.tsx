import { useEffect, useState, useMemo } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useAppSelector } from "../store/hooks"
import { blogApi, Post, PostComment } from "../services/api"
import { showToast } from "../utils/toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Ellipsis,
  Heart,
  Loader2,
  MessageCircle,
  Send,
  Share2,
} from "lucide-react"

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return "just now"
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return date.toLocaleDateString()
}

function getDisplayName(post: Post) {
  if (post.user?.userName) return post.user.userName
  if (post.user?.firstName || post.user?.lastName) {
    return `${post.user.firstName || ""} ${post.user.lastName || ""}`.trim()
  }
  return "Anonymous"
}

// Helper function to parse post content and extract title
function parsePostContent(content: string): { title: string; body: string } {
  if (!content) return { title: '', body: '' }
  
  // Check if content starts with <p><strong>...</strong></p> (title formatted as bold paragraph)
  const titleMatch1 = content.match(/^<p><strong>(.*?)<\/strong><\/p>(.*)$/s)
  if (titleMatch1) {
    const titleText = titleMatch1[1].replace(/<[^>]*>/g, '').trim()
    const bodyContent = titleMatch1[2].trim()
    if (titleText) {
      return { title: titleText, body: bodyContent || '' }
    }
  }
  
  // Check if content starts with <p><strong>...</strong> (without closing </p>)
  const titleMatch2 = content.match(/^<p><strong>(.*?)<\/strong>(.*?)(<\/p>.*)$/s)
  if (titleMatch2) {
    const titleText = titleMatch2[1].replace(/<[^>]*>/g, '').trim()
    const bodyContent = (titleMatch2[2] + titleMatch2[3]).trim()
    if (titleText) {
      return { title: titleText, body: bodyContent || '' }
    }
  }
  
  // Check if content starts with <strong>...</strong> (direct bold)
  const boldMatch = content.match(/^<strong>(.*?)<\/strong>(.*)$/s)
  if (boldMatch) {
    const titleText = boldMatch[1].replace(/<[^>]*>/g, '').trim()
    const bodyContent = boldMatch[2].trim()
    if (titleText && bodyContent) {
      return { title: titleText, body: bodyContent }
    }
  }
  
  // No title found, return empty title and full content as body
  return { title: '', body: content }
}

function FeedDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<PostComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const [liking, setLiking] = useState(false)

  useEffect(() => {
    if (id) {
      fetchPost()
      fetchComments()
    }
  }, [id])

  const fetchPost = async () => {
    if (!id) return
    try {
      setLoading(true)
      const data = await blogApi.getById(id)
      setPost(data)
    } catch (error) {
      console.error('Failed to fetch post:', error)
      showToast.error('Failed to load post')
      navigate('/feed')
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    if (!id) return
    try {
      setLoadingComments(true)
      const data = await blogApi.getComments(id)
      setComments(data)
    } catch (error) {
      console.error('Failed to fetch comments:', error)
      showToast.error('Failed to load comments')
    } finally {
      setLoadingComments(false)
    }
  }

  const handleLike = async () => {
    if (!post || !isAuthenticated || liking) return

    setLiking(true)
    try {
      const result = await blogApi.likePost(post.id)
      setPost({ ...post, isLiked: result.liked, likeCount: result.likeCount })
    } catch (error) {
      console.error('Failed to like post:', error)
      showToast.error('Failed to like post')
    } finally {
      setLiking(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !isAuthenticated || !post) return

    setSubmittingComment(true)
    try {
      const newComment = await blogApi.createComment(post.id, { content: commentText.trim() })
      setComments([newComment, ...comments])
      setCommentText('')
      showToast.success('Comment added!')
      if (post.commentCount !== undefined) {
        setPost({ ...post, commentCount: (post.commentCount || 0) + 1 })
      }
    } catch (error) {
      console.error('Failed to create comment:', error)
      showToast.error('Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleReport = async () => {
    if (!isAuthenticated || !post) {
      showToast.error("Sign in to report a post")
      setReportOpen(false)
      return
    }
    if (!reportReason.trim()) {
      showToast.warning("Please provide a reason")
      return
    }

    setSubmittingReport(true)
    try {
      await blogApi.reportPost(post.id, { reason: reportReason.trim(), details: reportDetails.trim() || undefined })
      showToast.success("Report submitted. Thank you for your feedback.")
      setReportOpen(false)
      setReportReason("")
      setReportDetails("")
    } catch (error) {
      console.error("Failed to report post:", error)
      showToast.error("Failed to submit report")
    } finally {
      setSubmittingReport(false)
    }
  }

  const displayName = useMemo(() => post ? getDisplayName(post) : '', [post])
  // Use post.title if available, otherwise try to parse from content for backward compatibility
  const title = post?.title || ''
  const body = post?.content || ''
  const avatarUrl = post?.user?.avatar || ""
  const avatarFallback = (displayName?.[0] || "A").toUpperCase()

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl py-4">
        <div className="mb-4">
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-20 w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="mx-auto w-full max-w-4xl py-4">
        <Card>
          <CardContent className="py-10 text-center">
            <div className="text-sm text-muted-foreground">Post not found.</div>
            <Button className="mt-4" onClick={() => navigate('/feed')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Feed
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl py-4">
      {/* Back Button */}
      <div className="mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/feed')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feed
        </Button>
      </div>

      {/* Post Card */}
      <Card className="overflow-hidden">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="truncate font-semibold">{displayName}</div>
                <div className="flex items-center gap-2">
                  <div className="shrink-0 text-sm text-muted-foreground">{formatTimeAgo(post.createdAt)}</div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                        <Ellipsis className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Post</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={async () => {
                          const url = `${window.location.origin}${window.location.pathname}`
                          try {
                            await navigator.clipboard.writeText(url)
                            showToast.success("Post link copied")
                          } catch {
                            showToast.error("Failed to copy link")
                          }
                        }}
                      >
                        Copy link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          setReportOpen(true)
                        }}
                      >
                        Report
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>

          {/* Title (bold) */}
          {title && (
            <div className="font-bold text-xl text-foreground pt-2">
              {title}
            </div>
          )}

          {/* Content (full, not truncated) */}
          <div 
            className="text-base text-foreground prose prose-base max-w-none whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: body || '' }}
          />
        </CardHeader>

        {/* Images */}
        {post.images && post.images.length > 0 ? (
          <CardContent className="pt-0 pb-4">
            <div
              className={[
                "grid gap-2",
                post.images.length === 1 ? "grid-cols-1" : "grid-cols-2",
              ].join(" ")}
            >
              {post.images.map((image, idx) => {
                const imageUrl = image.startsWith("http") ? image : image
                return (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-lg border bg-muted w-full max-h-[600px]"
                  >
                    <img
                      src={imageUrl}
                      alt={`Post image ${idx + 1}`}
                      className="w-full h-auto max-h-[600px] object-contain transition-opacity group-hover:opacity-90"
                      onError={() => console.error("Failed to load image:", imageUrl)}
                    />
                  </div>
                )
              })}
            </div>
          </CardContent>
        ) : null}

        {/* Engagement Stats */}
        <CardContent className="pt-0 pb-4">
          <div className="flex items-center gap-4">
            {post.likeCount !== undefined && post.likeCount > 0 ? (
              <Badge variant="secondary" className="gap-1">
                <Heart className="h-3 w-3 text-red-500" />
                {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}
              </Badge>
            ) : null}
            {post.commentCount !== undefined && post.commentCount > 0 ? (
              <Badge variant="secondary" className="gap-1">
                <MessageCircle className="h-3 w-3" />
                {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
              </Badge>
            ) : null}
          </div>
        </CardContent>

        <Separator />

        {/* Action Buttons */}
        {isAuthenticated && (
          <CardFooter className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              className="flex-1 gap-2"
              onClick={handleLike}
              disabled={liking}
            >
              <Heart
                className={[
                  "h-4 w-4",
                  post.isLiked ? "fill-red-500 text-red-500" : "",
                ].join(" ")}
              />
              Like
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="flex-1 gap-2"
              onClick={async () => {
                const url = `${window.location.origin}${window.location.pathname}`
                try {
                  await navigator.clipboard.writeText(url)
                  showToast.success("Link copied")
                } catch {
                  showToast.error("Failed to copy link")
                }
              }}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </CardFooter>
        )}

        <Separator />

        {/* Comments Section - Expanded by default */}
        <CardContent className="pt-6 space-y-4">
          <div className="text-base font-semibold">Comments</div>

          {/* Comment Input */}
          {isAuthenticated ? (
            <form onSubmit={handleSubmitComment} className="space-y-2">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full"
                  />
                  {commentText.trim() && (
                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={!commentText.trim() || submittingComment} 
                        size="sm"
                        className="gap-2"
                      >
                        {submittingComment ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Post
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </form>
          ) : (
            <div className="text-sm text-muted-foreground py-2">
              <Link to="/signin" className="text-primary hover:underline">
                Sign in
              </Link> to comment.
            </div>
          )}

          <Separator />

          {/* Comments List */}
          {loadingComments ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const name =
                  comment.user?.userName ||
                  comment.user?.firstName ||
                  "Anonymous"
                const fallback = (name?.[0] || "A").toUpperCase()
                return (
                  <div key={comment.id} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.user?.avatar || ""} alt={name} />
                      <AvatarFallback>{fallback}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="truncate text-sm font-semibold">{name}</div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          {formatTimeAgo(comment.createdAt)}
                        </div>
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm text-foreground">
                        {comment.content}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report post</DialogTitle>
            <DialogDescription>Tell us what is wrong with this post.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason</Label>
              <Input
                id="report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Spam, harassment, inappropriate content..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-details">Details (optional)</Label>
              <textarea
                id="report-details"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Add any additional information to help review."
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setReportOpen(false)} disabled={submittingReport}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleReport()} disabled={submittingReport}>
              {submittingReport ? "Submitting..." : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default FeedDetail

