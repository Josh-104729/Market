import { useEffect, useMemo, useRef, useState } from "react"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
  ChevronDown,
  Ellipsis,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  PlusCircle,
  Send,
  Share2,
  X,
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

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu)
  if (!matches) return []
  return matches.map((t) => t.toLowerCase())
}

const PostCard = ({ post, onLike }: { post: Post; onLike: (postId: string) => void }) => {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const { isAuthenticated } = useAppSelector((state) => state.auth)

  const toggleComments = async () => {
    const nextOpen = !showComments
    if (nextOpen && comments.length === 0) {
      setLoadingComments(true)
      try {
        const data = await blogApi.getComments(post.id)
        setComments(data)
      } catch (error) {
        console.error('Failed to load comments:', error)
        showToast.error('Failed to load comments')
      } finally {
        setLoadingComments(false)
      }
    }
    setShowComments(nextOpen)
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !isAuthenticated) return

    setSubmittingComment(true)
    try {
      const newComment = await blogApi.createComment(post.id, { content: commentText.trim() })
      setComments([newComment, ...comments])
      setCommentText('')
      showToast.success('Comment added!')
    } catch (error) {
      console.error('Failed to create comment:', error)
      showToast.error('Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleReport = async () => {
    if (!isAuthenticated) {
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

  const displayName = useMemo(() => getDisplayName(post), [post])
  const avatarUrl = post.user?.avatar || ""
  const avatarFallback = (displayName?.[0] || "A").toUpperCase()

  return (
    <>
      <Card id={`post-${post.id}`} className="overflow-hidden">
        <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback>{avatarFallback}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="truncate text-sm font-semibold">{displayName}</div>
              <div className="flex items-center gap-2">
                <div className="shrink-0 text-xs text-muted-foreground">{formatTimeAgo(post.createdAt)}</div>
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
                        const url = `${window.location.origin}${window.location.pathname}#post-${post.id}`
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
        <div className="whitespace-pre-wrap break-words text-sm text-foreground">
          {post.content}
        </div>
      </CardHeader>

      {post.images && post.images.length > 0 ? (
        <CardContent className="pt-0">
          <div
            className={[
              "grid gap-2",
              post.images.length === 1 ? "grid-cols-1" : "grid-cols-2",
            ].join(" ")}
          >
            {post.images.map((image, idx) => {
              const imageUrl = image.startsWith("http") ? image : image
              return (
                <button
                  key={idx}
                  type="button"
                  className="group relative overflow-hidden rounded-md border bg-muted"
                  onClick={() => window.open(imageUrl, "_blank")}
                >
                  <img
                    src={imageUrl}
                    alt={`Post image ${idx + 1}`}
                    className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                    onError={() => console.error("Failed to load image:", imageUrl)}
                  />
                </button>
              )
            })}
          </div>
        </CardContent>
      ) : null}

      <CardFooter className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {post.likeCount !== undefined && post.likeCount > 0 ? (
              <Badge variant="secondary" className="gap-1">
                <Heart className="h-3 w-3 text-red-500" />
                {post.likeCount}
              </Badge>
            ) : null}
            {post.commentCount !== undefined && post.commentCount > 0 ? (
              <Badge variant="secondary" className="gap-1">
                <MessageCircle className="h-3 w-3" />
                {post.commentCount}
              </Badge>
            ) : null}
          </div>
        </div>

        {isAuthenticated ? (
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              onClick={() => onLike(post.id)}
            >
              <Heart
                className={[
                  "h-4 w-4",
                  post.isLiked ? "fill-red-500 text-red-500" : "",
                ].join(" ")}
              />
              Like
            </Button>

            <Button type="button" variant="ghost" className="gap-2" onClick={toggleComments}>
              <MessageCircle className="h-4 w-4" />
              Comment
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              onClick={async () => {
                const url = `${window.location.origin}${window.location.pathname}#post-${post.id}`
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
          </div>
        ) : null}

        <Collapsible
          open={showComments}
          onOpenChange={(open) => {
            // When opened via the toggle button, data is loaded already.
            // If something else toggles it open, we still load on demand.
            if (open && comments.length === 0) void toggleComments()
            else setShowComments(open)
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Comments</div>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="gap-2">
                <ChevronDown className={["h-4 w-4 transition-transform", showComments ? "rotate-180" : ""].join(" ")} />
                {showComments ? "Hide" : "Show"}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="space-y-4 pt-3">
            <Separator />

            {isAuthenticated ? (
              <form onSubmit={handleSubmitComment}>
                <div className="flex items-start gap-2">
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                  />
                  <Button type="submit" disabled={!commentText.trim() || submittingComment} className="gap-2">
                    {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-sm text-muted-foreground">Sign in to comment.</div>
            )}

            {loadingComments ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No comments yet.</div>
            ) : (
              <div className="space-y-3">
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
                        <div className="flex items-center justify-between gap-3">
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
          </CollapsibleContent>
        </Collapsible>
        </CardFooter>
      </Card>

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
              <Textarea
                id="report-details"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Add any additional information to help review."
                rows={4}
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
    </>
  )
}

function Feed() {
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [feedTab, setFeedTab] = useState<"for-you" | "top">("for-you")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [postContent, setPostContent] = useState('')
  const [postImages, setPostImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [submittingPost, setSubmittingPost] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async (pageNum: number = 1) => {
    try {
      setLoading(true)
      const response = await blogApi.getAll({ page: pageNum, limit: 10 })
      if (pageNum === 1) {
        setPosts(response.data)
      } else {
        setPosts((prev) => [...prev, ...response.data])
      }
      setHasMore(response.page < response.totalPages)
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async (postId: string) => {
    if (!isAuthenticated) return

    try {
      const result = await blogApi.likePost(postId)
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? { ...post, isLiked: result.liked, likeCount: result.likeCount }
            : post
        )
      )
    } catch (error) {
      console.error('Failed to like post:', error)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 10) {
      showToast.warning('Maximum 10 images allowed')
      return
    }

    setPostImages(files)
    const previews = files.map((file) => URL.createObjectURL(file))
    setImagePreviews(previews)
  }

  const removeImage = (index: number) => {
    setPostImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleCreatePost = async () => {
    if (!postContent.trim() || !isAuthenticated) return

    setSubmittingPost(true)
    try {
      await blogApi.create({ content: postContent.trim() }, postImages.length > 0 ? postImages : undefined)
      setPostContent('')
      setPostImages([])
      setImagePreviews([])
      setIsCreatingPost(false)
      showToast.success('Post submitted for review. It will appear after approval.')
    } catch (error) {
      console.error('Failed to create post:', error)
      showToast.error('Failed to create post')
    } finally {
      setSubmittingPost(false)
    }
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchPosts(nextPage)
    }
  }

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of posts) {
      for (const tag of extractHashtags(post.content || "")) {
        counts.set(tag, (counts.get(tag) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }))
  }, [posts])

  const visiblePosts = useMemo(() => {
    let data = [...posts]

    // Only show published posts on the public feed
    data = data.filter((p) => p.status === 'published')

    if (activeTag) {
      data = data.filter((p) => extractHashtags(p.content || "").includes(activeTag))
    }

    if (feedTab === "top") {
      data.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
    }

    return data
  }, [posts, activeTag, feedTab])

  return (
    <div className="mx-auto w-full max-w-6xl py-4">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-2xl font-bold tracking-tight">Feed</div>
              <div className="text-sm text-muted-foreground">Updates, thoughts, and images from the community.</div>
            </div>

            <Tabs value={feedTab} onValueChange={(v) => setFeedTab(v as any)}>
              <TabsList>
                <TabsTrigger value="for-you">For you</TabsTrigger>
                <TabsTrigger value="top">Top</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Composer */}
          {isAuthenticated ? (
            <Card>
              <CardHeader className="pb-6">
                {!isCreatingPost ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-auto w-full justify-start gap-3 px-4 py-5 text-left shadow-sm"
                    onClick={() => setIsCreatingPost(true)}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <PlusCircle className="h-5 w-5" />
                    </span>
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-base font-semibold text-foreground">Create a post</span>
                      <span className="text-sm text-muted-foreground">Share an update, ask a question, or add photos.</span>
                    </span>
                  </Button>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Create post</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreatingPost(false)
                        setPostContent("")
                        setPostImages([])
                        setImagePreviews([])
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>

              {isCreatingPost ? (
                <CardContent className="space-y-4">
                  <Textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Write something..."
                    rows={4}
                  />

                  {imagePreviews.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {imagePreviews.map((preview, idx) => (
                        <div key={idx} className="group relative overflow-hidden rounded-md border bg-muted">
                          <img src={preview} alt={`Preview ${idx + 1}`} className="h-28 w-full object-cover" />
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => removeImage(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="secondary" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                        <ImageIcon className="h-4 w-4" />
                        Add images
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <div className="text-xs text-muted-foreground">Up to 10 images</div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreatingPost(false)
                          setPostContent("")
                          setPostImages([])
                          setImagePreviews([])
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="button" disabled={!postContent.trim() || submittingPost} className="gap-2" onClick={() => void handleCreatePost()}>
                        {submittingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {submittingPost ? "Posting..." : "Post"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6">
                <div className="text-sm text-muted-foreground">Sign in to create posts and interact.</div>
              </CardContent>
            </Card>
          )}

          {/* Active filter */}
          {activeTag ? (
            <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
              <div className="text-sm">
                Filtering by <span className="font-semibold">{activeTag}</span>
              </div>
              <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => setActiveTag(null)}>
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          ) : null}

          {/* Feed */}
          {loading && posts.length === 0 ? (
            <div className="space-y-3">
              <Card><CardContent className="py-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
              <Card><CardContent className="py-6"><Skeleton className="h-28 w-full" /></CardContent></Card>
              <Card><CardContent className="py-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
            </div>
          ) : visiblePosts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <div className="text-sm text-muted-foreground">
                  {posts.length === 0 ? "No posts yet. Be the first to share something." : "No posts match your filter."}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {visiblePosts.map((post) => (
                <PostCard key={post.id} post={post} onLike={handleLike} />
              ))}

              {hasMore ? (
                <div className="flex justify-center pt-2">
                  <Button type="button" variant="outline" onClick={loadMore} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading ? "Loading..." : "Load more"}
                  </Button>
                </div>
              ) : (
                <div className="py-2 text-center text-xs text-muted-foreground">You're all caught up.</div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="text-sm font-semibold">Trending</div>
              <div className="text-xs text-muted-foreground">Popular topics from recent posts.</div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {trendingTags.length === 0 ? (
                <div className="text-sm text-muted-foreground">No trending tags yet.</div>
              ) : (
                trendingTags.map(({ tag, count }) => (
                  <Button
                    key={tag}
                    type="button"
                    variant={activeTag === tag ? "default" : "secondary"}
                    size="sm"
                    className="h-8 gap-2 rounded-full px-3"
                    onClick={() => setActiveTag(tag)}
                  >
                    <span>{tag}</span>
                    <Badge variant="outline" className="h-5 px-2 text-[10px]">
                      {count}
                    </Badge>
                  </Button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="text-sm font-semibold">Tips</div>
              <div className="text-xs text-muted-foreground">Make your post stand out.</div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>Use <span className="font-medium text-foreground">#tags</span> to help others discover your post.</div>
              <div>Keep it short, clear, and add images when helpful.</div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export default Feed

