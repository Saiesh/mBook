import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-green-700 mb-2">mBook</h1>
          <p className="text-gray-600">Landscaping Measurement Management</p>
        </header>

        <div className="max-w-md mx-auto space-y-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Quick Actions</h2>
            <div className="space-y-3">
              <Link 
                href="/measurements/new"
                className="block w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors"
              >
                + New Measurement
              </Link>
              <Link 
                href="/measurements"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors"
              >
                View Measurements
              </Link>
            </div>
          </div>

          {/* Recent Measurements */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Recent Measurements</h2>
            <p className="text-gray-500 text-sm text-center py-4">
              No measurements yet. Create your first one!
            </p>
          </div>

          {/* Admin Access */}
          <div className="text-center">
            <Link 
              href="/admin"
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Admin Panel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
