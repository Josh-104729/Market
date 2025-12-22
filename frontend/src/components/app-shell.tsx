import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAppSelector } from "../store/hooks"

export function AppShell() {
  const { user } = useAppSelector((state) => state.auth)

  const sidebarUser = {
    name:
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.userName ||
      "User",
    email: user?.email || "",
    avatar: user?.avatar || "",
  }

  return (
    <SidebarProvider>
      <AppSidebar user={sidebarUser} />
      <SidebarInset>
        <SiteHeader />
        <div className="@container/main flex flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


