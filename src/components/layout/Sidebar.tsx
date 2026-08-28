"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Role } from "@/lib/types";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  CheckSquare,
  Settings,
  ClipboardList,
  UserCheck,
  Award,
  ListTodo,
  FolderOpen,
  Megaphone,
  CalendarDays,
  BarChart3,
  BookOpen,
  Radio,
  AlertTriangle,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  admin: [
    { label: "Command Center", href: "/admin/command-center", icon: LayoutDashboard },
    { label: "Applications", href: "/admin/applications", icon: FileText },
    { label: "Departments", href: "/admin/departments", icon: Building2 },
    { label: "Team", href: "/admin/team", icon: Users },
    { label: "Approvals", href: "/core/approvals", icon: CheckSquare },
    { label: "Tasks", href: "/tasks", icon: ListTodo },
    { label: "Files", href: "/files", icon: FolderOpen },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "Meetings", href: "/meetings", icon: CalendarDays },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
    { label: "Event Day", href: "/event-day", icon: Radio },
    { label: "Issues", href: "/issues", icon: AlertTriangle },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
  core: [
    { label: "Approval Center", href: "/core/approvals", icon: CheckSquare },
    { label: "Applications", href: "/admin/applications", icon: FileText },
    { label: "Tasks", href: "/tasks", icon: ListTodo },
    { label: "Files", href: "/files", icon: FolderOpen },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "Meetings", href: "/meetings", icon: CalendarDays },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
    { label: "Event Day", href: "/event-day", icon: Radio },
    { label: "Issues", href: "/issues", icon: AlertTriangle },
  ],
  department_head: [
    { label: "Department", href: "/department", icon: Building2 },
    { label: "Applicants", href: "/department/applicants", icon: UserCheck },
    { label: "Tasks", href: "/tasks", icon: ListTodo },
    { label: "Files", href: "/files", icon: FolderOpen },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "Meetings", href: "/meetings", icon: CalendarDays },
    { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
    { label: "Issues", href: "/issues", icon: AlertTriangle },
  ],
  volunteer: [
    { label: "My Dashboard", href: "/volunteer", icon: LayoutDashboard },
    { label: "Tasks", href: "/tasks", icon: ListTodo },
    { label: "Files", href: "/files", icon: FolderOpen },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "Meetings", href: "/meetings", icon: CalendarDays },
    { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
    { label: "Issues", href: "/issues", icon: AlertTriangle },
  ],
  applicant: [
    { label: "My Application", href: "/applicant", icon: ClipboardList },
  ],
  unassigned: [
    { label: "Pending", href: "/pending", icon: Award },
  ],
};

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role] ?? [];

  return (
    <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white md:flex md:flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-neutral-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EB0028] text-sm font-bold text-white">
          TX
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">TEDxNIFT</p>
          <p className="text-xs leading-tight text-neutral-500">Jodhpur</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[#EB0028]/10 text-[#EB0028]"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
