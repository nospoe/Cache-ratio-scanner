import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import NewScan from "./pages/NewScan";
import ScanList from "./pages/ScanList";
import ScanDashboard from "./pages/ScanDashboard";
import PageRankings from "./pages/PageRankings";
import PageRankingsView from "./pages/PageRankingsView";
import PageDetail from "./pages/PageDetail";
import GlobalRankings from "./pages/GlobalRankings";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/scans" replace />} />
        <Route path="scans" element={<ScanList />} />
        <Route path="scans/new" element={<NewScan />} />
        {/* NOTE: /scans/:id/pages/rankings must be BEFORE /scans/:id/pages/:pageId */}
        <Route path="scans/:id/rankings" element={<PageRankingsView />} />
        <Route path="scans/:id/pages/rankings" element={<PageRankingsView />} />
        <Route path="scans/:id/pages/:pageId" element={<PageDetail />} />
        <Route path="scans/:id/pages" element={<PageRankings />} />
        <Route path="scans/:id" element={<ScanDashboard />} />
        <Route path="rankings" element={<GlobalRankings />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
