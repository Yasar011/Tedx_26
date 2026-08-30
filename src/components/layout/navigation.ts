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

export interface NavItem {
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
  unassigned: [{ label: "Pending", href: "/pending", icon: Award }],
};

/**
 * The navigation for a given person, shared by the desktop sidebar and the
 * mobile drawer so the two can never drift apart.
 */
export function navItemsFor(
  role: Role,
  opts: { isCoHead?: boolean; hasDepartment?: boolean } = {}
): NavItem[] {
  let items = NAV_BY_ROLE[role] ?? [];

  // Anyone who also runs a department — a Co-Head, or an Admin/Core member
  // assigned to one — gets the department-lead links layered on top. Note a
  // plain volunteer also has a departmentId, so holding one only qualifies
  // for admin/core.
  const alsoLeadsDepartment =
    role !== "department_head" &&
    (opts.isCoHead === true ||
      ((role === "admin" || role === "core") && opts.hasDepartment === true));

  if (alsoLeadsDepartment) {
    const leadOnly = NAV_BY_ROLE.department_head.filter(
      (leadItem) => !items.some((i) => i.href === leadItem.href)
    );
    items = [...leadOnly, ...items];
  }

  return items;
}

export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}
