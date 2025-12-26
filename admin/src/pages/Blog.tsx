import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSearch,
  faSpinner,
  faCheck,
  faArchive,
  faExclamationTriangle,
  faChevronLeft,
  faChevronRight,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { blogApi, Post } from '../services/api'

interface ConfirmDialog {
  postId: string
  postContent: string
  action: 'publish' | 'archive' | 'delete'
  newStatus?: 'draft' | 'published' | 'archived'
}

function Blog() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const itemsPerPage = 10

  const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
  const resolveImageUrl = (imagePath: string) => {
    try {
      return new URL(imagePath, BACKEND_BASE_URL).toString()
    } catch {
      return `${BACKEND_BASE_URL}${imagePath}`
    }
  }

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [statusFilter])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when search changes
  }, [searchTerm])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPosts()
    }, searchTerm ? 300 : 0)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, searchTerm])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      }
      const response = await blogApi.getAll(params)
      let filteredPosts = response.data

      // Apply status filter
      if (statusFilter) {
        filteredPosts = filteredPosts.filter((post) => post.status === statusFilter)
      }

      // Apply search filter
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase()
        filteredPosts = filteredPosts.filter(
          (post) =>
            post.content.toLowerCase().includes(search) ||
            post.user?.firstName?.toLowerCase().includes(search) ||
            post.user?.lastName?.toLowerCase().includes(search) ||
            post.user?.userName?.toLowerCase().includes(search) ||
            post.user?.email?.toLowerCase().includes(search),
        )
      }

      setPosts(filteredPosts)
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (error) {
      console.error('Failed to fetch posts:', error)
      alert('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChangeClick = (
    id: string,
    content: string,
    action: 'publish' | 'archive' | 'delete',
    newStatus?: 'draft' | 'published' | 'archived',
  ) => {
    setConfirmDialog({
      postId: id,
      postContent: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      action,
      newStatus,
    })
  }

  const handleStatusChange = async () => {
    if (!confirmDialog) return

    try {
      if (confirmDialog.action === 'delete') {
        await blogApi.delete(confirmDialog.postId)
      } else if (confirmDialog.newStatus) {
        await blogApi.updateStatus(confirmDialog.postId, confirmDialog.newStatus)
      }
      setConfirmDialog(null)
      fetchPosts()
    } catch (error) {
      console.error('Failed to update post:', error)
      alert('Failed to update post')
      setConfirmDialog(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: 'bg-neutral-700 text-neutral-200',
      published: 'bg-green-900 text-green-200',
      archived: 'bg-yellow-900 text-yellow-200',
    }
    return badges[status as keyof typeof badges] || badges.draft
  }

  const getUserName = (post: Post) => {
    if (post.user?.userName) return post.user.userName
    if (post.user?.firstName || post.user?.lastName) {
      return `${post.user.firstName || ''} ${post.user.lastName || ''}`.trim()
    }
    return post.user?.email || 'Anonymous'
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">Blog Management</h1>
          <p className="text-blue-100">Review and manage all blog posts</p>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="bg-neutral-800 rounded-xl shadow-md p-6 mb-6">
          <div className="relative">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-4 top-1/2 transform -tranneutral-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search posts by content or author..."
              className="w-full pl-12 pr-4 py-3 border border-neutral-700 bg-neutral-700 text-neutral-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Status Filter Bar */}
        <div className="bg-neutral-800 rounded-xl shadow-md p-4 mb-6 overflow-x-auto">
          <div className="flex items-center space-x-2 min-w-max">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                statusFilter === ''
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              All Statuses
            </button>
            <button
              onClick={() => setStatusFilter('draft')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                statusFilter === 'draft'
                  ? 'bg-neutral-600 text-white shadow-md'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              Draft
            </button>
            <button
              onClick={() => setStatusFilter('published')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                statusFilter === 'published'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              Published
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                statusFilter === 'archived'
                  ? 'bg-yellow-600 text-white shadow-md'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              Archived
            </button>
          </div>
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="text-center py-20 bg-neutral-800 rounded-xl shadow-md">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-400 mb-4" />
            <p className="text-neutral-400">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-neutral-800 rounded-xl shadow-md">
            <p className="text-neutral-400 mb-6 text-lg">No posts found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="bg-neutral-800 rounded-xl shadow-md border border-neutral-700 p-6">
                <div className="flex items-start space-x-4">
                  {/* Post Images */}
                  {post.images && post.images.length > 0 && (
                    <div className="flex-shrink-0">
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-neutral-700">
                        <img
                          src={resolveImageUrl(post.images[0])}
                          alt="Post"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {post.images.length > 1 && (
                        <div className="text-xs text-neutral-400 mt-1 text-center">+{post.images.length - 1} more</div>
                      )}
                    </div>
                  )}

                  {/* Post Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-white font-semibold">{getUserName(post)}</span>
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                              post.status,
                            )}`}
                          >
                            {post.status}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-400">
                          {new Date(post.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <p className="text-neutral-200 mb-3 line-clamp-3">{post.content}</p>
                    <div className="flex items-center space-x-4 text-sm text-neutral-400">
                      {post.likeCount !== undefined && (
                        <span>❤️ {post.likeCount} likes</span>
                      )}
                      {post.commentCount !== undefined && (
                        <span>💬 {post.commentCount} comments</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col space-y-2">
                    {post.status === 'draft' && (
                      <button
                        onClick={() => handleStatusChangeClick(post.id, post.content, 'publish', 'published')}
                        className="text-green-400 hover:text-green-300 font-medium px-3 py-1 rounded hover:bg-green-900/30 transition-all flex items-center space-x-1"
                        title="Publish"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                        <span>Publish</span>
                      </button>
                    )}
                    {post.status === 'published' && (
                      <button
                        onClick={() => handleStatusChangeClick(post.id, post.content, 'archive', 'archived')}
                        className="text-yellow-400 hover:text-yellow-300 font-medium px-3 py-1 rounded hover:bg-yellow-900/30 transition-all flex items-center space-x-1"
                        title="Archive"
                      >
                        <FontAwesomeIcon icon={faArchive} />
                        <span>Archive</span>
                      </button>
                    )}
                    {post.status === 'archived' && (
                      <button
                        onClick={() => handleStatusChangeClick(post.id, post.content, 'publish', 'published')}
                        className="text-green-400 hover:text-green-300 font-medium px-3 py-1 rounded hover:bg-green-900/30 transition-all flex items-center space-x-1"
                        title="Unarchive"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                        <span>Unarchive</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChangeClick(post.id, post.content, 'delete')}
                      className="text-red-400 hover:text-red-300 font-medium px-3 py-1 rounded hover:bg-red-900/30 transition-all flex items-center space-x-1"
                      title="Delete"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="bg-neutral-800 rounded-xl shadow-md p-6 mt-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-neutral-400">
                Showing {posts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
                {Math.min(currentPage * itemsPerPage, total)} of {total} posts
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-neutral-600 rounded-lg font-medium text-neutral-300 hover:bg-neutral-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                  <span>Previous</span>
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'border border-neutral-600 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-neutral-600 rounded-lg font-medium text-neutral-300 hover:bg-neutral-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <span>Next</span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmDialog && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setConfirmDialog(null)}
          >
            <div
              className="bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                      confirmDialog.action === 'delete'
                        ? 'bg-red-900'
                        : confirmDialog.action === 'archive'
                        ? 'bg-yellow-900'
                        : 'bg-green-900'
                    }`}
                  >
                    <FontAwesomeIcon
                      icon={confirmDialog.action === 'delete' ? faTrash : faExclamationTriangle}
                      className={`text-2xl ${
                        confirmDialog.action === 'delete'
                          ? 'text-red-300'
                          : confirmDialog.action === 'archive'
                          ? 'text-yellow-300'
                          : 'text-green-300'
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-neutral-100">
                      {confirmDialog.action === 'delete'
                        ? 'Delete Post'
                        : confirmDialog.action === 'archive'
                        ? 'Archive Post'
                        : 'Publish Post'}
                    </h3>
                    <p className="text-sm text-neutral-400 mt-1">
                      {confirmDialog.action === 'delete'
                        ? 'This action cannot be undone'
                        : confirmDialog.action === 'archive'
                        ? 'This will hide the post from the feed'
                        : 'This will make the post visible to users'}
                    </p>
                  </div>
                </div>
                <p className="text-neutral-300 mb-6">
                  Are you sure you want to {confirmDialog.action} the post{' '}
                  <span className="font-semibold">"{confirmDialog.postContent}"</span>?
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-6 py-3 border-2 border-neutral-600 rounded-lg text-neutral-300 font-semibold hover:bg-neutral-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStatusChange}
                    className={`px-6 py-3 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg ${
                      confirmDialog.action === 'delete'
                        ? 'bg-red-600 hover:bg-red-700'
                        : confirmDialog.action === 'archive'
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {confirmDialog.action === 'delete'
                      ? 'Delete Post'
                      : confirmDialog.action === 'archive'
                      ? 'Archive Post'
                      : 'Publish Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Blog

