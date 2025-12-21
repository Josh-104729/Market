import { Link } from 'react-router-dom'
import {
  FolderTree,
  Users,
  ShoppingCart,
  Briefcase,
  FileText,
  Wallet,
  ArrowUpRight,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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
      color: 'bg-emerald-50 text-emerald-600',
      available: true,
    },
    {
      title: 'Withdraws',
      description: 'Review and process withdrawal requests',
      icon: ArrowUpRight,
      link: '/withdraws',
      color: 'bg-orange-50 text-orange-600',
      available: true,
    },
    {
      title: 'Users',
      description: 'Manage user accounts',
      icon: Users,
      link: '#',
      color: 'bg-pink-50 text-pink-600',
      available: false,
    },
    {
      title: 'Orders',
      description: 'Manage orders',
      icon: ShoppingCart,
      link: '#',
      color: 'bg-green-50 text-green-600',
      available: false,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="rounded-2xl bg-card text-card-foreground border border-border p-8 md:p-12 shadow-sm overflow-hidden relative">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Welcome to the OmniMart Admin Panel. Manage your platform, services, and users from one central location.
          </p>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full -mr-12 -mb-12 blur-2xl" />
      </div>

      {/* Menu Items */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Management</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {menuItems.map((item) => {
            const content = (
              <Card className={`h-full transition-all duration-300 border-border ${
                item.available 
                  ? 'hover:shadow-md hover:border-primary/50 cursor-pointer group' 
                  : 'opacity-60 cursor-not-allowed bg-muted/40'
              }`}>
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mb-2 shadow-sm transition-transform group-hover:scale-110`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors flex items-center justify-between">
                    {item.title}
                    {!item.available && (
                      <Badge variant="secondary" className="text-[10px] font-bold">Soon</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {item.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            )

            return item.available ? (
              <Link key={item.title} to={item.link}>
                {content}
              </Link>
            ) : (
              <div key={item.title}>{content}</div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
