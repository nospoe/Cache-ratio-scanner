import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { BarChart2, LayoutDashboard, Plus, Settings, Zap } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";

const navItems = [
  { to: "/scans/new", icon: Plus, label: "New Scan" },
  { to: "/scans", icon: LayoutDashboard, label: "Scan History", end: true },
  { to: "/rankings", icon: BarChart2, label: "Global Rankings" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 leading-tight">Site Scanner</p>
              <p className="text-[10px] text-gray-400">Performance + CDN</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-400">v1.0.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <Breadcrumbs />
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
