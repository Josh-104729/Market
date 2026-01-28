import { Link, useLocation } from "react-router-dom"
import { MailIcon, PlusCircleIcon, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  quickCreateTo = "/services/new",
  inboxTo = "/notifications",
  unreadMessagesCount = 0,
}: {
  items: {
    title: string
    to: string
    icon?: LucideIcon
  }[]
  quickCreateTo?: string
  inboxTo?: string
  unreadMessagesCount?: number
}) {
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              asChild
              tooltip="Quick Create"
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
            >
              <Link to={quickCreateTo}>
              <PlusCircleIcon />
              <span>Quick Create</span>
              </Link>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
              asChild
            >
              <Link to={inboxTo}>
              <MailIcon />
              <span className="sr-only">Inbox</span>
              </Link>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to)
                }
              >
                <Link to={item.to} className="relative">
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  {item.to === "/chat" && unreadMessagesCount > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] font-semibold bg-primary text-primary-foreground">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </Badge>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
