import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, LayoutDashboard, Globe, List, FileText, Plus, BarChart2 } from "lucide-react";
import { scanApi, pageApi } from "../../api/client";

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function formatScanLabel(rootInput: string): string {
  return truncate(rootInput.replace(/^https?:\/\//, ""), 44);
}

function formatPageLabel(url: string): string {
  try {
    const { pathname } = new URL(url);
    return truncate(pathname || "/", 48);
  } catch {
    return truncate(url, 48);
  }
}

interface Crumb {
  label: string;
  to?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);

  // Extract IDs — hooks must be called unconditionally
  const scanId = segments[0] === "scans" && segments[1] && segments[1] !== "new"
    ? segments[1] : null;
  const pageId = scanId && segments[2] === "pages" && segments[3]
    ? segments[3] : null;

  const { data: scan, isLoading: scanLoading } = useQuery({
    queryKey: ["scan", scanId],
    queryFn: () => scanApi.get(scanId!),
    enabled: !!scanId,
    staleTime: 60_000,
  });

  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ["page", scanId, pageId],
    queryFn: () => pageApi.get(scanId!, pageId!),
    enabled: !!scanId && !!pageId,
    staleTime: 60_000,
  });

  // Build crumb list
  const crumbs: Crumb[] = [];

  if (segments[0] === "scans") {
    crumbs.push({ label: "Scans", to: "/scans", icon: <LayoutDashboard className="w-3.5 h-3.5" /> });

    if (segments[1] === "new") {
      crumbs.push({ label: "New Scan", icon: <Plus className="w-3.5 h-3.5" /> });
    } else if (scanId) {
      const sl = scan ? formatScanLabel(scan.root_input) : null;
      const scanCrumb: Crumb = {
        label: sl ?? "",
        to: `/scans/${scanId}`,
        icon: <Globe className="w-3.5 h-3.5" />,
        loading: scanLoading && !sl,
      };

      if (pageId) {
        crumbs.push({ ...scanCrumb, to: `/scans/${scanId}` });
        crumbs.push({ label: "Pages", to: `/scans/${scanId}/pages`, icon: <List className="w-3.5 h-3.5" /> });
        const pl = page ? formatPageLabel(page.original_url) : null;
        crumbs.push({
          label: pl ?? "",
          icon: <FileText className="w-3.5 h-3.5" />,
          loading: pageLoading && !pl,
        });
      } else if (segments[2] === "pages") {
        crumbs.push({ ...scanCrumb, to: `/scans/${scanId}` });
        crumbs.push({ label: "Pages", icon: <List className="w-3.5 h-3.5" /> });
      } else if (segments[2] === "rankings") {
        crumbs.push({ ...scanCrumb, to: `/scans/${scanId}` });
        crumbs.push({ label: "Rankings", icon: <BarChart2 className="w-3.5 h-3.5" /> });
      } else {
        crumbs.push(scanCrumb);
      }
    }
  } else if (segments[0] === "rankings") {
    crumbs.push({ label: "Global Rankings", icon: <BarChart2 className="w-3.5 h-3.5" /> });
  } else {
    // No breadcrumb for top-level single pages (settings, etc.)
    return null;
  }

  if (crumbs.length < 2) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 px-6 h-11 border-b border-gray-200 bg-white shadow-sm shrink-0"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;

        const content = crumb.loading ? (
          <span className="inline-block w-28 h-3 rounded bg-gray-200 animate-pulse" />
        ) : (
          <span className="flex items-center gap-1.5 min-w-0">
            <span className={isLast ? "text-blue-600" : "text-gray-400"}>{crumb.icon}</span>
            <span className="truncate">{crumb.label}</span>
          </span>
        );

        return (
          <span key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            )}
            {isLast || !crumb.to ? (
              <span className="text-sm font-semibold text-gray-900 min-w-0 flex items-center">
                {content}
              </span>
            ) : (
              <Link
                to={crumb.to}
                className="text-sm text-gray-500 hover:text-blue-600 transition-colors min-w-0 flex items-center rounded px-1 py-0.5 hover:bg-blue-50"
              >
                {content}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
