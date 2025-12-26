import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "../store/hooks"
import { updateUser, User as UserType } from "../store/slices/authSlice"
import { showToast } from "../utils/toast"
import {
  authApi,
  blogApi,
  conversationApi,
  milestoneApi,
  serviceApi,
  Conversation,
  Milestone,
  Post,
  Service,
} from "../services/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  BarChart3,
  Briefcase,
  Camera,
  CheckCircle2,
  Coins,
  Loader2,
  Mail,
  MessageCircle,
  Newspaper,
  Shield,
  User,
  User2,
} from "lucide-react"

type TabType = "overview" | "information" | "services" | "conversations" | "milestones" | "posts" | "statistics"

function Profile() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { user: storeUser, isAuthenticated } = useAppSelector((state) => state.auth)
  const [user, setUser] = useState<UserType | null>(storeUser)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    userName: "",
    firstName: "",
    lastName: "",
    middleName: "",
    bio: "",
    address: "",
    phoneNumber: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Avatar upload
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Data states
  const [services, setServices] = useState<Service[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/signin")
      return
    }

    const fetchProfile = async () => {
      try {
        setLoading(true)
        const profileData = await authApi.getProfile()
        setUser(profileData)
        setEditForm({
          userName: profileData.userName || "",
          firstName: profileData.firstName || "",
          lastName: profileData.lastName || "",
          middleName: profileData.middleName || "",
          bio: profileData.bio || "",
          address: profileData.address || "",
          phoneNumber: profileData.phoneNumber || "",
        })
      } catch (error) {
        console.error('Failed to fetch profile:', error)
        setUser(storeUser)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [isAuthenticated, navigate, storeUser])

  useEffect(() => {
    if (!user?.id) return

    // Prefetch data needed for the top "Quick stats" cards on first load
    // (otherwise they show 0 until the user opens each tab).
    const prefetchOverviewStats = async () => {
      setLoadingStats(true)
      try {
        // Services (use paginated endpoint; we only need the data array for current UI lists)
        const servicesRes = await serviceApi.getMyServices({ limit: 200 })
        setServices(Array.isArray(servicesRes.data) ? servicesRes.data : [])

        // Conversations (API returns all; filter for this user)
        const conversationsData = await conversationApi.getAll()
        const userConversations = conversationsData.filter(
          (conv) => conv.clientId === user.id || conv.providerId === user.id
        )
        setConversations(userConversations)

        // Milestones (fetch per conversation; filter for this user)
        if (userConversations.length > 0) {
          const milestonePromises = userConversations.map((conv) => milestoneApi.getByConversation(conv.id))
          const milestoneResults = await Promise.all(milestonePromises)
          const allMilestones = milestoneResults.flat()
          const userMilestones = allMilestones.filter(
            (milestone) => milestone.clientId === user.id || milestone.providerId === user.id
          )
          setMilestones(userMilestones)
        } else {
          setMilestones([])
        }

        // Posts (backend endpoint lists published posts; filter by current user)
        const postsRes = await blogApi.getAll({ limit: 200 })
        const userPosts = (postsRes.data || []).filter((post) => post.userId === user.id)
        setPosts(userPosts)
      } catch (err) {
        console.error("Failed to prefetch profile stats:", err)
        // Don't toast here to avoid noisy UX on every profile load
      } finally {
        setLoadingStats(false)
      }
    }

    prefetchOverviewStats()

    const fetchTabData = async () => {
      setLoadingData(true)
      try {
        switch (activeTab) {
          case "services":
            const servicesData = await serviceApi.getMyServices({ limit: 50 })
            setServices(servicesData.data)
            break
          case "conversations":
            const conversationsData = await conversationApi.getAll()
            const userConversations = conversationsData.filter(
              (conv) => conv.clientId === user.id || conv.providerId === user.id
            )
            setConversations(userConversations)
            break
          case "milestones":
            const allConversations = await conversationApi.getAll()
            const userConvs = allConversations.filter(
              (conv) => conv.clientId === user.id || conv.providerId === user.id
            )
            const milestonePromises = userConvs.map((conv) => milestoneApi.getByConversation(conv.id))
            const milestoneResults = await Promise.all(milestonePromises)
            const allMilestones = milestoneResults.flat()
            const userMilestones = allMilestones.filter(
              (milestone) => milestone.clientId === user.id || milestone.providerId === user.id
            )
            setMilestones(userMilestones)
            break
          case "posts":
            const postsData = await blogApi.getAll({ limit: 50 })
            const userPosts = postsData.data.filter((post) => post.userId === user.id)
            setPosts(userPosts)
            break
        }
      } catch (error) {
        console.error(`Failed to fetch ${activeTab}:`, error)
        showToast.error(`Failed to load ${activeTab}`)
      } finally {
        setLoadingData(false)
      }
    }

    fetchTabData()
  }, [activeTab, user?.id])

  const handleSave = async () => {
    setError("")
    setSaving(true)
    try {
      const updatedProfile = await authApi.updateProfile(editForm)
      setUser(updatedProfile)
      dispatch(updateUser(updatedProfile))
      setIsEditing(false)
      showToast.success("Profile updated successfully!")
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update profile'
      setError(errorMessage)
      showToast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setError("")
    if (user) {
      setEditForm({
        userName: user.userName || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        middleName: user.middleName || "",
        bio: user.bio || "",
        address: user.address || "",
        phoneNumber: user.phoneNumber || "",
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Calculate statistics
  const stats = {
    totalServices: services.length,
    activeServices: services.filter((s) => s.status === "active").length,
    totalConversations: conversations.length,
    totalMilestones: milestones.length,
    completedMilestones: milestones.filter((m) => m.status === "completed" || m.status === "released").length,
    totalPosts: posts.length,
    totalEarnings: milestones
      .filter((m) => (m.status === "completed" || m.status === "released") && m.providerId === user?.id)
      .reduce((sum, m) => sum + m.balance, 0),
    totalSpent: milestones
      .filter((m) => (m.status === "completed" || m.status === "released") && m.clientId === user?.id)
      .reduce((sum, m) => sum + m.balance, 0),
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 py-4">
        <Skeleton className="h-56 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <div className="text-sm text-muted-foreground">No user data available.</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fullName =
    (user.firstName || user.lastName)
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
      : ""

  // Header should never use a raw email as the big title (not user-friendly).
  const headerTitle = fullName || (user.userName ? `@${user.userName}` : "My Profile")
  const avatarLabel = fullName || user.userName || user.email
  const avatarFallback = (avatarLabel?.[0] || "U").toUpperCase()

  const validateAvatarFile = (file: File) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!validTypes.includes(file.type)) return "Only JPG, PNG, GIF, or WEBP image files are allowed."
    if (file.size > 5 * 1024 * 1024) return "Image size must be less than 5MB."
    return null
  }

  const onPickAvatar = (file?: File | null) => {
    if (!file) return
    const validation = validateAvatarFile(file)
    if (validation) {
      showToast.error(validation)
      return
    }
    setAvatarFile(file)
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const uploadAvatar = async () => {
    if (!avatarFile) return
    setAvatarUploading(true)
    try {
      const updated = await authApi.updateAvatar(avatarFile)
      setUser(updated)
      dispatch(updateUser(updated))
      showToast.success("Avatar updated!")
      setAvatarDialogOpen(false)
      setAvatarFile(null)
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to update avatar"
      showToast.error(msg)
    } finally {
      setAvatarUploading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-4">
      {/* Profile header */}
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary/20 via-primary/10 to-background" />
        <CardContent className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-background shadow-sm">
                <AvatarImage src={user.avatar || ""} alt={avatarLabel} />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
              </Avatar>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full shadow"
                onClick={() => setAvatarDialogOpen(true)}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-w-0">
              <div className="truncate text-xl font-bold">{headerTitle}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {fullName && user.userName ? <span className="truncate">@{user.userName}</span> : null}
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="max-w-[22rem] truncate" title={user.email}>
                    {user.email}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge variant={user.emailVerified ? "secondary" : "outline"} className="gap-1">
                  <Mail className="h-3 w-3" />
                  {user.emailVerified ? "Email verified" : "Email not verified"}
                </Badge>
                <Badge variant={user.twoFactorEnabled ? "secondary" : "outline"} className="gap-1">
                  <Shield className="h-3 w-3" />
                  {user.twoFactorEnabled ? "2FA enabled" : "2FA off"}
                </Badge>
                {user.status ? <Badge variant="outline">{user.status}</Badge> : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/settings/security">
                <Shield className="h-4 w-4" />
                Security
              </Link>
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                setActiveTab("information")
                setIsEditing(true)
              }}
            >
              <User className="h-4 w-4" />
              Edit profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-9 w-16" />
                <Skeleton className="mt-2 h-4 w-24" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{stats.totalServices}</div>
                <div className="text-sm text-muted-foreground">{stats.activeServices} active</div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Conversations</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-9 w-16" />
                <Skeleton className="mt-2 h-4 w-16" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{stats.totalConversations}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Milestones</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-9 w-16" />
                <Skeleton className="mt-2 h-4 w-28" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{stats.totalMilestones}</div>
                <div className="text-sm text-muted-foreground">{stats.completedMilestones} completed</div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Posts</CardTitle>
              <Newspaper className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-9 w-16" />
                <Skeleton className="mt-2 h-4 w-28" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{stats.totalPosts}</div>
                <div className="text-sm text-muted-foreground">Published / Draft</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="information" className="gap-2">
            <User className="h-4 w-4" />
            Info
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="conversations" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Chats
          </TabsTrigger>
          <TabsTrigger value="milestones" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Milestones
          </TabsTrigger>
          <TabsTrigger value="posts" className="gap-2">
            <Newspaper className="h-4 w-4" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="statistics" className="gap-2">
            <Coins className="h-4 w-4" />
            Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Earnings</CardTitle>
                <CardDescription>Based on completed milestones.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Total earned</div>
                  <div className="font-semibold">{formatCurrency(stats.totalEarnings)}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Total spent</div>
                  <div className="font-semibold">{formatCurrency(stats.totalSpent)}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription>Quick account details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="truncate text-sm font-medium">{user.email}</div>
                </div>
                {/* {user.phoneNumber ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">Phone</div>
                    <div className="truncate text-sm font-medium">{user.phoneNumber}</div>
                  </div>
                ) : null} */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">Role</div>
                  <div className="truncate text-sm font-medium capitalize">{user.role}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="information">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Profile information</CardTitle>
                  <CardDescription>Update your public profile details.</CardDescription>
                </div>
                {!isEditing ? (
                  <Button type="button" variant="outline" onClick={() => setIsEditing(true)} className="gap-2">
                    <User className="h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input value={user.email} readOnly />
                  <div className="text-xs text-muted-foreground">Email cannot be changed.</div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User2 className="h-4 w-4" />
                    Username
                  </Label>
                  <Input
                    value={isEditing ? editForm.userName : (user.userName || "")}
                    readOnly={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, userName: e.target.value })}
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input
                    value={isEditing ? editForm.firstName : (user.firstName || "")}
                    readOnly={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input
                    value={isEditing ? editForm.lastName : (user.lastName || "")}
                    readOnly={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Middle name</Label>
                  <Input
                    value={isEditing ? editForm.middleName : (user.middleName || "")}
                    readOnly={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })}
                    placeholder="(Optional)"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone number
                  </Label>
                  <Input
                    value={isEditing ? editForm.phoneNumber : (user.phoneNumber || "")}
                    readOnly={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div> */}
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={isEditing ? editForm.address : (user.address || "")}
                    readOnly={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Enter address"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea
                  value={isEditing ? editForm.bio : (user.bio || "")}
                  readOnly={!isEditing}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={4}
                  placeholder="Tell us about yourself..."
                />
              </div>

              {isEditing ? (
                <>
                  <Separator />
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>My services</CardTitle>
                  <CardDescription>{services.length} total</CardDescription>
                </div>
                <Button asChild className="gap-2">
                  <Link to="/services/new">
                    <Briefcase className="h-4 w-4" />
                    Create service
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : services.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-8 text-center">
                  <div className="text-sm text-muted-foreground">No services yet.</div>
                  <div className="pt-4">
                    <Button asChild>
                      <Link to="/services/new">Create your first service</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {services.map((s) => (
                    <Card key={s.id} className="hover:shadow-sm">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="line-clamp-2 text-base">{s.title}</CardTitle>
                          <Badge variant={s.status === "active" ? "secondary" : "outline"} className="shrink-0">
                            {s.status}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">{s.adText}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{formatCurrency(s.balance)}</div>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/services/${s.id}`}>Open</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversations">
          <Card>
            <CardHeader>
              <CardTitle>Conversations</CardTitle>
              <CardDescription>{conversations.length} total</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingData ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : conversations.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                  No conversations found.
                </div>
              ) : (
                conversations.map((conv) => {
                  const otherUser = conv.clientId === user.id ? conv.provider : conv.client
                  const otherUserName = otherUser
                    ? `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() || otherUser.userName || "Unknown"
                    : "Unknown"
                  const fallback = (otherUserName?.[0] || "U").toUpperCase()
                  return (
                    <Link key={conv.id} to={`/chat/${conv.id}`} className="block">
                      <div className="flex items-center justify-between gap-4 rounded-lg border p-4 hover:bg-muted/30">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{fallback}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{otherUserName}</div>
                            {conv.service ? (
                              <div className="truncate text-xs text-muted-foreground">{conv.service.title}</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">{formatDate(conv.updatedAt)}</div>
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
              <CardDescription>{milestones.length} total</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingData ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : milestones.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                  No milestones found.
                </div>
              ) : (
                milestones.map((m) => (
                  <div key={m.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{m.description}</div>
                        <div className="pt-2 text-xs text-muted-foreground">{formatDate(m.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <Badge variant={m.status === "completed" || m.status === "released" ? "secondary" : "outline"}>
                          {m.status}
                        </Badge>
                        <div className="pt-2 text-sm font-semibold">{formatCurrency(m.balance)}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>My posts</CardTitle>
                  <CardDescription>{posts.length} total</CardDescription>
                </div>
                <Button asChild variant="outline">
                  <Link to="/feed">Open feed</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingData ? (
                <>
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </>
              ) : posts.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-8 text-center">
                  <div className="text-sm text-muted-foreground">No posts yet.</div>
                  <div className="pt-4">
                    <Button asChild>
                      <Link to="/feed">Create your first post</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                posts.map((p) => (
                  <Card key={p.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</div>
                        <Badge variant={p.status === "published" ? "secondary" : "outline"}>{p.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="whitespace-pre-wrap break-words text-sm">{p.content}</div>
                      {p.images && p.images.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {p.images.slice(0, 4).map((img, idx) => (
                            <img
                              key={idx}
                              src={img.startsWith("http") ? img : img}
                              alt={`Post image ${idx + 1}`}
                              className="h-32 w-full rounded-md object-cover"
                            />
                          ))}
                        </div>
                      ) : null}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {p.likeCount !== undefined ? <span>{p.likeCount} likes</span> : null}
                        {p.commentCount !== undefined ? <span>{p.commentCount} comments</span> : null}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Earnings</CardTitle>
                <CardDescription>Totals based on completed milestones.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Total earnings</div>
                  <div className="font-semibold">{formatCurrency(stats.totalEarnings)}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Total spent</div>
                  <div className="font-semibold">{formatCurrency(stats.totalSpent)}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Counts across your account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Services</div>
                  <div className="font-semibold">{stats.totalServices}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Conversations</div>
                  <div className="font-semibold">{stats.totalConversations}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Milestones</div>
                  <div className="font-semibold">{stats.totalMilestones}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Posts</div>
                  <div className="font-semibold">{stats.totalPosts}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Avatar change dialog */}
      <Dialog
        open={avatarDialogOpen}
        onOpenChange={(open) => {
          setAvatarDialogOpen(open)
          if (!open) {
            setAvatarFile(null)
            if (avatarPreview) URL.revokeObjectURL(avatarPreview)
            setAvatarPreview(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change avatar</DialogTitle>
            <DialogDescription>Upload a JPG/PNG/GIF/WEBP image (max 5MB).</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarPreview || user.avatar || ""} alt={avatarLabel} />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <Button type="button" variant="secondary" className="gap-2" onClick={() => avatarInputRef.current?.click()}>
                  <Camera className="h-4 w-4" />
                  Choose image
                </Button>
                <div className="text-xs text-muted-foreground">Square images look best.</div>
              </div>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => onPickAvatar(e.target.files?.[0] || null)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAvatarDialogOpen(false)} disabled={avatarUploading}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void uploadAvatar()} disabled={!avatarFile || avatarUploading} className="gap-2">
              {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {avatarUploading ? "Uploading..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Profile
