import { Link } from 'react-router-dom'
import {
  FolderTree,
  Users,
  ShoppingCart,
  Briefcase,
  FileText,
  Wallet,
  ArrowUpRight,
  ArrowLeftRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function Dashboard() {
  const menuItems = [
    {
      title: 'Categories',
      description: 'Manage service categories',
      icon: FolderTree,
      link: '/categories',
      color: 'bg-blue-50 text-blue-600',
      available: true,
    },
    {
      title: 'Services',
      description: 'Review and manage services',
      icon: Briefcase,
      link: '/services',
      color: 'bg-purple-50 text-purple-600',
      available: true,
    },
    {
      title: 'Blog',
      description: 'Manage blog posts and feed',
      icon: FileText,
      link: '/blog',
      color: 'bg-indigo-50 text-indigo-600',
      available: true,
    },
    {
      title: 'Temp Wallets',
      description: 'Manage temp wallets and transfers',
      icon: Wallet,
      link: '/temp-wallets',
      color: 'bg-emerald-500/10 text-emerald-600',
      available: true,
    },
    {
      title: 'Withdraws',
      description: 'Review and process withdrawal requests',
      icon: ArrowUpRight,
      link: '/withdraws',
      color: 'bg-orange-500/10 text-orange-600',
      available: true,
    },
    {
      title: 'Master Wallet',
      description: 'Review wallet transaction history',
      icon: ArrowLeftRight,
      link: '/master-wallet',
      color: 'bg-sky-500/10 text-sky-600',
      available: true,
    },
    {
      title: 'Users',
      description: 'Manage user accounts',
      icon: Users,
      link: '#',
      color: 'bg-pink-500/10 text-pink-600',
      available: false,
    },
    {
      title: 'Orders',
      description: 'Manage orders',
      icon: ShoppingCart,
      link: '#',
      color: 'bg-green-500/10 text-green-600',
      available: false,
    },
  ]

  const activeModules = menuItems.filter((item) => item.available).length
  const comingSoon = menuItems.length - activeModules
  const financeModules = menuItems.filter((item) =>
    ["Temp Wallets", "Withdraws", "Master Wallet"].includes(item.title)
  ).length

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-border">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Admin Overview
              </Badge>
              <Badge variant="outline">All systems</Badge>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Manage content, payments, and support workflows from a unified control center.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <Button asChild>
              <Link to="/services">Review services</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/withdraws">Process withdrawals</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-4 border-t border-border bg-muted/20 p-6 md:grid-cols-3">
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active modules</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeModules}</div>
              <p className="text-xs text-muted-foreground">Currently live tools</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Finance workflows</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{financeModules}</div>
              <p className="text-xs text-muted-foreground">Wallet and payout tools</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coming soon</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{comingSoon}</div>
              <p className="text-xs text-muted-foreground">Modules in roadmap</p>
            </CardContent>
          </Card>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Management</h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {menuItems.map((item) => (
            <Card
              key={item.title}
              className={`h-full transition-all duration-300 border-border ${
                item.available ? "hover:shadow-md hover:border-primary/40 group" : "opacity-60 bg-muted/40"
              }`}
            >
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.color} shadow-sm transition-transform group-hover:scale-105`}
                  >
                    <item.icon className="h-6 w-6" />
                  </div>
                  {!item.available && (
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      Soon
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription className="text-sm">{item.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {item.available ? (
                  <Button asChild className="w-full">
                    <Link to={item.link}>Open</Link>
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Planned
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
