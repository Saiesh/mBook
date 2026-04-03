import Image from "next/image";
import Link from "next/link";
import { ProjectRepository } from "@/lib/project-management/repositories/ProjectRepository";
import { supabaseAdmin } from "@/lib/supabase";

async function getProjectStats() {
  if (!supabaseAdmin) {
    return { total: 0, active: 0 };
  }
  try {
    const repository = new ProjectRepository(supabaseAdmin);
    const [allResult, activeResult] = await Promise.all([
      repository.findAll({ page: 1, limit: 1 }),
      repository.findAll({ status: "active", page: 1, limit: 1 }),
    ]);
    return {
      total: allResult.pagination.total,
      active: activeResult.pagination.total,
    };
  } catch {
    return { total: 0, active: 0 };
  }
}

export default async function AdminPage() {
  const projectStats = await getProjectStats();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Why: favicon mirrors the same home-anchor pattern used on /measurements, keeping navigation consistent across the two primary sections. */}
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Go to landing page" className="rounded-md transition-opacity hover:opacity-75">
              <Image
                src="/favicon-32x32.png"
                alt="mBook home"
                width={28}
                height={28}
                className="rounded-md"
                priority
              />
            </Link>
            {/* Why: direct link to /measurements lets admins jump to the field-capture section without navigating via the landing page. */}
            <Link
              href="/measurements"
              aria-label="Go to measurements"
              className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="Measurements"
            >
              {/* Ruler icon — semantically maps to measurement/capture activity */}
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.3 8.7 8.7 21.3c-.6.6-1.5.6-2.1 0l-6-6a1.5 1.5 0 0 1 0-2.1L13.3 2.7a1.5 1.5 0 0 1 2.1 0l6 6a1.5 1.5 0 0 1-.1 2z" />
                <path d="m7.5 10.5 2 2" />
                <path d="m10.5 7.5 2 2" />
                <path d="m13.5 4.5 2 2" />
                <path d="m4.5 13.5 2 2" />
              </svg>
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">Admin Panel</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Configuration Cards — only surfacing sections with live functionality */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Configuration</h2>
          <div className="space-y-3">
            <Link 
              href="/admin/projects"
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-800">Project Management</h3>
              <p className="text-sm text-gray-500 mt-1">
                Manage projects, areas, and teams
              </p>
            </Link>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{projectStats.total}</div>
              <div className="text-sm text-gray-600">Total Projects</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{projectStats.active}</div>
              <div className="text-sm text-gray-600">Active Projects</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-600">0</div>
              <div className="text-sm text-gray-600">Total Measurements</div>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              {/* Use ₹ symbol to match the app-wide INR currency standard */}
              <div className="text-2xl font-bold text-amber-600">₹0</div>
              <div className="text-sm text-gray-600">Total Billed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
