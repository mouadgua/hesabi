"use client"

import * as React from "react"
import Image from "next/image" //
import Link from 'next/link'

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import RealtimeProcessingCounter from "@/components/realtime-processing-counter"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboardIcon, FolderIcon, Settings2Icon, CircleHelpIcon, CommandIcon, InboxIcon } from "lucide-react"

export function AppSidebar({ user, cabinet, pendingCount = 0, processingCount = 0, ...props }) {
  const data = {
    navMain: [
      {
        title: "Tableau de bord",
        url: "/dashboard",
        icon: <LayoutDashboardIcon />,
      },
      {
        title: "Extraction",
        url: "/dashboard/verification",
        icon: <InboxIcon />,
        badge: pendingCount,
      },
      {
        title: "Modèles",
        url: "/dashboard/models",
        icon: <FolderIcon />,
      },
    ],
    navSecondary: [
      {
        title: "Paramètres",
        url: "/dashboard/settings",
        icon: <Settings2Icon />,
      },
      {
        title: "Support & Aide",
        url: "/support",
        icon: <CircleHelpIcon />,
      },
    ],
    documents: [],
  }
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link href="/dashboard" className="flex items-center gap-2">
                
                {/* 👈 AFFICHAGE DYNAMIQUE DU LOGO */}
                {cabinet?.logo_url ? (
                  <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-white border border-gray-200">
                    <Image src={cabinet.logo_url} alt="Logo" fill sizes="24px" className="object-contain p-0.5" />
                  </div>
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white shrink-0">
                    <CommandIcon className="size-4" />
                  </div>
                )}
                
                {/* 👈 AFFICHAGE DYNAMIQUE DU NOM */}
                <span className="truncate text-base font-semibold">{cabinet?.nom || "Acme Inc."}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-1">
          <RealtimeProcessingCounter initialCount={processingCount} />
        </div>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}