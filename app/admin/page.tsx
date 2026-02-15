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
          <Link href="/" className="text-green-600 hover:text-green-700">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-800">Admin Panel</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Configuration Cards */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Configuration</h2>
          <div className="space-y-3">
            <Link 
              href="/admin/pricing"
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-800">Pricing Settings</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure rates and billing rules
              </p>
            </Link>
            
            <Link 
              href="/admin/users"
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-800">User Management</h3>
              <p className="text-sm text-gray-500 mt-1">
                Manage team members and permissions
              </p>
            </Link>

            <Link 
              href="/admin/projects"
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-800">Project Management</h3>
              <p className="text-sm text-gray-500 mt-1">
                Manage projects, areas, and teams
              </p>
            </Link>

            <Link 
              href="/admin/llm"
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-800">LLM Settings</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure AI integration and features
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
              <div className="text-2xl font-bold text-amber-600">$0</div>
              <div className="text-sm text-gray-600">Total Billed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
