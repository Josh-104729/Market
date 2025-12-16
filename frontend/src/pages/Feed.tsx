import { useEffect, useState, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHeart,
  faComment,
  faShare,
  faSpinner,
  faImage,
  faTimes,
  faPaperPlane,
} from '@fortawesome/free-solid-svg-icons'
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons'
import { useAppSelector } from '../store/hooks'
import { blogApi, Post, PostComment } from '../services/api'
import { showToast } from '../utils/toast'

const PostCard = ({ post, onLike, onComment }: { post: Post; onLike: (postId: string) => void; onComment: (postId: string, content: string) => void }) => {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const { isAuthenticated } = useAppSelector((state) => state.auth)

  const loadComments = async () => {
    if (!showComments && comments.length === 0) {
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
    setShowComments(!showComments)
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const getUserName = () => {
    if (post.user?.userName) return post.user.userName
    if (post.user?.firstName || post.user?.lastName) {
      return `${post.user.firstName || ''} ${post.user.lastName || ''}`.trim()
    }
    return 'Anonymous'
  }

  return (
    <div className="glass-card rounded-2xl p-6 mb-4">
      {/* Post Header */}
      <div className="flex items-start space-x-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {post.user?.avatar ? (
            <img src={post.user.avatar} alt={getUserName()} className="w-full h-full rounded-full object-cover" />
          ) : (
            <span>{getUserName().charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-lg">{getUserName()}</h3>
          <p className="text-gray-400 text-sm">{formatTimeAgo(post.createdAt)}</p>
        </div>
      </div>

      {/* Post Content */}
      <div className="mb-4">
        <p className="text-gray-200 whitespace-pre-wrap break-words">{post.content}</p>
      </div>

      {/* Post Images */}
      {post.images && post.images.length > 0 && (
        <div className={`mb-4 grid gap-2 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {post.images.map((image, idx) => {
            // Use full B2 URL if it's already a full URL, otherwise use as-is
            const imageUrl = image.startsWith('http') ? image : image;
            return (
              <div key={idx} className="relative rounded-lg overflow-hidden bg-gray-700">
                <img
                  src={imageUrl}
                  alt={`Post image ${idx + 1}`}
                  className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(imageUrl, '_blank')}
                  onError={() => {
                    // Fallback handling if image fails to load
                    console.error('Failed to load image:', imageUrl);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Post Stats */}
      <div className="flex items-center justify-between text-gray-400 text-sm mb-4 pb-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          {post.likeCount !== undefined && post.likeCount > 0 && (
            <span className="flex items-center space-x-1">
              <FontAwesomeIcon icon={faHeart} className="text-red-500" />
              <span>{post.likeCount}</span>
            </span>
          )}
          {post.commentCount !== undefined && post.commentCount > 0 && (
            <span className="flex items-center space-x-1">
              <FontAwesomeIcon icon={faComment} className="text-blue-400" />
              <span>{post.commentCount}</span>
            </span>
          )}
        </div>
      </div>

      {/* Post Actions */}
      {isAuthenticated && (
        <div className="flex items-center justify-around border-t border-gray-700 pt-4">
          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
              post.isLiked
                ? 'text-red-500 hover:bg-red-500/10'
                : 'text-gray-400 hover:text-red-500 hover:bg-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={post.isLiked ? faHeart : faHeartRegular} className="text-xl" />
            <span className="font-medium">Like</span>
          </button>
          <button
            onClick={loadComments}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-700 transition-all"
          >
            <FontAwesomeIcon icon={faComment} className="text-xl" />
            <span className="font-medium">Comment</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-400 hover:text-green-400 hover:bg-gray-700 transition-all">
            <FontAwesomeIcon icon={faShare} className="text-xl" />
            <span className="font-medium">Share</span>
          </button>
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          {loadingComments ? (
            <div className="flex justify-center py-4">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-blue-400 text-xl" />
            </div>
          ) : (
            <>
              {/* Comment Input */}
              {isAuthenticated && (
                <form onSubmit={handleSubmitComment} className="mb-4">
                  <div className="flex items-start space-x-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 glass-card text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 placeholder-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim() || submittingComment}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-glow-primary hover:shadow-glow-primary-lg"
                    >
                      <FontAwesomeIcon icon={submittingComment ? faSpinner : faPaperPlane} className={submittingComment ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </form>
              )}

              {/* Comments List */}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No comments yet. Be the first to comment!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {comment.user?.avatar ? (
                          <img src={comment.user.avatar} alt={comment.user.userName || 'User'} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span>{(comment.user?.userName || comment.user?.firstName || 'A').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 glass-card rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white font-semibold text-sm">
                            {comment.user?.userName || comment.user?.firstName || 'Anonymous'}
                          </span>
                          <span className="text-slate-400 text-xs">{formatTimeAgo(comment.createdAt)}</span>
                        </div>
                        <p className="text-slate-200 text-sm">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Feed() {
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
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

  const handleComment = async (postId: string, content: string) => {
    if (!isAuthenticated) return

    try {
      await blogApi.createComment(postId, { content })
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? { ...post, commentCount: (post.commentCount || 0) + 1 }
            : post
        )
      )
    } catch (error) {
      console.error('Failed to create comment:', error)
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

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!postContent.trim() || !isAuthenticated) return

    setSubmittingPost(true)
    try {
      const newPost = await blogApi.create({ content: postContent.trim() }, postImages.length > 0 ? postImages : undefined)
      setPosts([newPost, ...posts])
      setPostContent('')
      setPostImages([])
      setImagePreviews([])
      setIsCreatingPost(false)
      showToast.success('Post created successfully!')
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

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-3xl">
        {/* Create Post Card */}
        {isAuthenticated && (
          <div className="glass-card rounded-2xl p-6 mb-6">
            {!isCreatingPost ? (
              <button
                onClick={() => setIsCreatingPost(true)}
                className="w-full text-left glass-card hover:bg-white/15 rounded-xl px-4 py-3 text-slate-300 transition-all"
              >
                <span>What's on your mind?</span>
              </button>
            ) : (
              <form onSubmit={handleCreatePost}>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full glass-card text-white rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 resize-none placeholder-slate-400"
                  rows={4}
                />

                {/* Image Previews */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {imagePreviews.map((preview, idx) => (
                      <div key={idx} className="relative">
                        <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-32 object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                        >
                          <FontAwesomeIcon icon={faTimes} className="text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-gray-400 hover:text-blue-400 transition-colors"
                    >
                      <FontAwesomeIcon icon={faImage} className="text-xl" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingPost(false)
                        setPostContent('')
                        setPostImages([])
                        setImagePreviews([])
                      }}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!postContent.trim() || submittingPost}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2 shadow-glow-primary hover:shadow-glow-primary-lg hover:-translate-y-1"
                    >
                      {submittingPost ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                          <span>Posting...</span>
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faPaperPlane} />
                          <span>Post</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Posts Feed */}
        {loading && posts.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-2xl">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-primary mb-4" />
            <p className="text-slate-400">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-2xl">
            <p className="text-slate-400 mb-6 text-lg">No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onLike={handleLike} onComment={handleComment} />
            ))}
            {hasMore && (
              <div className="text-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-3 glass-card text-white rounded-full hover:bg-white/15 disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Feed

