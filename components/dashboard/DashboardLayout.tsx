"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { DashboardNotification } from "@/lib/queries/notifications";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: any;
  profile: any;
  business: any;
  businesses?: any[];
  assistant: any;
  subscription?: {
    plan: string;
    status: string;
    messagesUsed: number;
    messagesLimit: number;
  } | null;
  notifications?: DashboardNotification[];
}

export default function DashboardLayout({ 
  children, 
  user,
  profile,
  business,
  businesses = [],
  assistant,
  subscription,
  notifications = [],
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen max-w-full overflow-x-hidden bg-slate-50">
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        subscription={subscription}
      />
      
      <div className="flex-1 flex flex-col min-w-0 max-w-full">
        <Topbar 
          onMenuClick={() => setIsSidebarOpen(true)} 
          user={user} 
          profile={profile}
          business={business}
          businesses={businesses}
          assistant={assistant}
          notifications={notifications}
        />
        
        <main className="flex-1 min-w-0 max-w-full overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
