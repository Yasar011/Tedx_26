"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Application } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { FileText, Search, ChevronRight, Image as ImageIcon } from "lucide-react";

export default function AdminApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "applications"));
      setApplications(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Application))
          .sort((a, b) => b.createdAt - a.createdAt)
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <FullPageSpinner />;

  const departments = Array.from(new Set(applications.map((a) => a.departmentPreference))).filter(Boolean);

  const filtered = applications.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
    const matchesDept = deptFilter === "ALL" || a.departmentPreference === deptFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">All Applications</h1>
        <p className="text-sm text-neutral-500">{applications.length} total submissions</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-lg border border-neutral-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#EB0028]/40"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-lg border border-neutral-300 px-3 text-sm">
          <option value="ALL">All statuses</option>
          {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="h-9 rounded-lg border border-neutral-300 px-3 text-sm">
          <option value="ALL">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No applications found" description="Try adjusting your filters." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Applied</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtered.map((a) => (
                    // The whole row navigates — previously only the name was a
                    // link, and it was styled identically to plain text, so the
                    // page's primary action was effectively invisible.
                    <tr
                      key={a.id}
                      onClick={() => router.push(`/admin/applications/${a.id}`)}
                      className="cursor-pointer transition-colors hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {a.photoUrl ? (
                            // Cloudinary URL — next/image would need the host allow-listed.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.photoUrl}
                              alt=""
                              className="h-11 w-9 shrink-0 rounded border border-neutral-200 object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-9 shrink-0 items-center justify-center rounded border border-dashed border-neutral-200 bg-neutral-50">
                              <ImageIcon className="h-4 w-4 text-neutral-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-neutral-900">{a.name}</p>
                            <p className="truncate text-xs text-neutral-500">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{a.departmentPreference}</td>
                      <td className="px-4 py-3">
                        <Badge className={APPLICATION_STATUS_COLORS[a.status]}>
                          {APPLICATION_STATUS_LABELS[a.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-500">{formatDate(a.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/applications/${a.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                        >
                          View full <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
