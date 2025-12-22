import * as React from "react"
import {
  ArrowUpCircleIcon,
  BellIcon,
  BriefcaseIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  RssIcon,
  SettingsIcon,
  UserCircleIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import { Link } from "react-router-dom"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar({
  user,
  onLogout,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string }
  onLogout?: () => void
}) {
  const navMain = [
    { title: "Dashboard", to: "/", icon: LayoutDashboardIcon },
    { title: "Feed", to: "/feed", icon: RssIcon },
    { title: "Services", to: "/services", icon: BriefcaseIcon },
    { title: "Chat", to: "/chat", icon: MessageSquareIcon },
    { title: "Referral", to: "/referral", icon: UsersIcon },
  ]

  const navSecondary = [
    { title: "Profile", to: "/profile", icon: UserCircleIcon },
    { title: "Security", to: "/settings/security", icon: SettingsIcon },
    // { title: "Wallet", to: "/transactions", icon: WalletIcon },
    { title: "Notifications", to: "/notifications", icon: BellIcon },
    { title: "Get Help", to: "/support", icon: HelpCircleIcon },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/">
                <ArrowUpCircleIcon className="h-5 w-5" />
                <span className="text-base font-semibold">OmniMart</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} quickCreateTo="/services/new" inboxTo="/notifications" />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
