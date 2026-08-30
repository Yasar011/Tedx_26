"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
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
  BarChart3,
  Mail,
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
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Messages", href: "/messages", icon: Mail },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
  core: [
    { label: "Approval Center", href: "/core/approvals", icon: CheckSquare },
    { label: "Applications", href: "/admin/applications", icon: FileText },
    { label: "Tasks", href: "/tasks", icon: ListTodo },
    { label: "Files", href: "/files", icon: FolderOpen },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Messages", href: "/messages", icon: Mail },
  ],
  department_head: [
    { label: "Department", href: "/department", icon: Building2 },
    { label: "Applicants", href: "/department/applicants", icon: UserCheck },
    { label: "Tasks", href: "/tasks", icon: ListTodo },
    { label: "Files", href: "/files", icon: FolderOpen },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "Messages", href: "/messages", icon: Mail },
  ],
  volunteer: [
    { label: "My Dashboard", href: "/volunteer", icon: LayoutDashboard },
    { label: "Tasks", href: "/tasks", icon: ListTodo },
    { label: "Files", href: "/files", icon: FolderOpen },
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "Messages", href: "/messages", icon: Mail },
  ],
  applicant: [
    { label: "My Application", href: "/applicant", icon: ClipboardList },
    { label: "Messages", href: "/messages", icon: Mail },
  ],
  unassigned: [
    { label: "Pending", href: "/pending", icon: Award },
  ],
};

export function Sidebar({
  role,
  isCoHead,
  hasDepartment,
}: {
  role: Role;
  isCoHead?: boolean;
  hasDepartment?: boolean;
}) {
  const pathname = usePathname();
  let items = NAV_BY_ROLE[role] ?? [];

  // Anyone who also runs a department — a Co-Head, or an Admin/Core member
  // assigned to one — gets the department-lead links layered on top of
  // whatever their base role already shows. Note a plain volunteer also has
  // a departmentId, so holding one is only qualifying for admin/core.
  const alsoLeadsDepartment =
    role !== "department_head" &&
    (isCoHead === true || ((role === "admin" || role === "core") && hasDepartment === true));

  if (alsoLeadsDepartment) {
    const leadOnly = NAV_BY_ROLE.department_head.filter(
      (leadItem) => !items.some((i) => i.href === leadItem.href)
    );
    items = [...leadOnly, ...items];
  }

  return (
    <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white md:flex md:flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-neutral-200 px-4">
        <Link href="/dashboard" className="flex items-center">
          <Logo priority className="h-8 w-auto" />
        </Link>
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
