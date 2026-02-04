import { useEffect, useState } from "react"
import { adminApi, User } from "../services/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, Mail, Calendar, DollarSign, Ban, CheckCircle } from "lucide-react"
import { showToast } from "../utils/toast"

function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [statusChangeDialog, setStatusChangeDialog] = useState<{
    userId: string;
    userName: string;
    currentStatus: string;
    newStatus: 'active' | 'blocked';
  } | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters or page size change
  }, [itemsPerPage])

  // Debounced search effect - only triggers fetch after user stops typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUsers()
    }, searchTerm ? 500 : 0) // 500ms debounce for search, immediate for other filters
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, itemsPerPage])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await adminApi.getAllUsers({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm || undefined,
      })
      setUsers(response.data)
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (error) {
      console.error("Failed to fetch users:", error)
      showToast.error("Failed to load users. Please check the console for details.")
    } finally {
      setLoading(false)
    }
  }

  const { pages } = (() => {
    const pageCount = totalPages
    const current = currentPage
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, current - delta); i <= Math.min(pageCount - 1, current + delta); i++) {
      range.push(i)
    }

    if (current - delta > 2) {
      rangeWithDots.push(1, "...")
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (current + delta < pageCount - 1) {
      rangeWithDots.push("...", pageCount)
    } else {
      rangeWithDots.push(pageCount)
    }

    return {
      pages: rangeWithDots.filter((p) => p !== 1 || pageCount === 1 ? true : current !== 1),
    }
  })()

  const startItem = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, total)

  const getUserDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`
    }
    return user.userName || user.email || "Unknown"
  }

  const getUserInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    }
    if (user.userName) {
      return user.userName[0].toUpperCase()
    }
    return user.email[0].toUpperCase()
  }

  const handleStatusChangeClick = (userId: string, userName: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active'
    setStatusChangeDialog({
      userId,
      userName,
      currentStatus,
      newStatus,
    })
  }

  const handleStatusChange = async () => {
    if (!statusChangeDialog) return

    setChangingStatus(true)
    try {
      await adminApi.updateUserStatus(statusChangeDialog.userId, statusChangeDialog.newStatus)
      showToast.success(`User status changed to ${statusChangeDialog.newStatus}`)
      setStatusChangeDialog(null)
      fetchUsers()
    } catch (error: any) {
      console.error('Failed to update user status:', error)
      showToast.error(error.response?.data?.message || 'Failed to update user status')
    } finally {
      setChangingStatus(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">View and manage all registered users (role: user).</p>
        </div>
        <Badge variant="secondary">Total users: {total}</Badge>
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search by email, username, or name.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search users..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Showing {startItem} to {endItem} of {total} users
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Users List</CardTitle>
            <CardDescription>All registered users with role 'user' on the platform.</CardDescription>
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
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <Search className="h-5 w-5" />
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Referrals</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {getUserInitials(user)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{getUserDisplayName(user)}</span>
                            {user.userName && (
                              <span className="text-xs text-muted-foreground">@{user.userName}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "default" : "destructive"}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.emailVerified && (
                            <Badge variant="outline" className="text-xs">
                              Email
                            </Badge>
                          )}
                          {user.phoneVerified && (
                            <Badge variant="outline" className="text-xs">
                              Phone
                            </Badge>
                          )}
                          {!user.emailVerified && !user.phoneVerified && (
                            <span className="text-xs text-muted-foreground">Not verified</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.totalReferrals > 0 ? (
                          <Badge variant="secondary">{user.totalReferrals}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            ${user.totalSpent.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={user.status === "active" ? "destructive" : "default"}
                          size="sm"
                          onClick={() => handleStatusChangeClick(user.id, getUserDisplayName(user), user.status)}
                        >
                          {user.status === "active" ? (
                            <>
                              <Ban className="h-4 w-4 mr-1" />
                              Block
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Unblock
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {totalPages > 1 && (
          <CardContent>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {pages.map((page, index) => (
                  <PaginationItem key={index}>
                    {page === "..." ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => setCurrentPage(page as number)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardContent>
        )}
      </Card>

      <Dialog open={!!statusChangeDialog} onOpenChange={(open) => !open && setStatusChangeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Status</DialogTitle>
            <DialogDescription>
              Are you sure you want to {statusChangeDialog?.newStatus === 'blocked' ? 'block' : 'unblock'} the user{" "}
              <strong>{statusChangeDialog?.userName}</strong>?{" "}
              {statusChangeDialog?.newStatus === 'blocked' && 'This will log them out immediately.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusChangeDialog(null)}
              disabled={changingStatus}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={changingStatus}
              variant={statusChangeDialog?.newStatus === 'blocked' ? 'destructive' : 'default'}
            >
              {changingStatus ? 'Changing...' : statusChangeDialog?.newStatus === 'blocked' ? 'Block User' : 'Unblock User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Users

