import Link from "next/link";

export default function MeasurementsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-green-600 hover:text-green-700">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-800">Measurements</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="mb-4">
          <Link 
            href="/measurements/new"
            className="block w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors"
          >
            + New Measurement
          </Link>
        </div>

        <div className="space-y-3">
          {/* Placeholder for measurements list */}
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-gray-500">No measurements found</p>
            <p className="text-sm text-gray-400 mt-2">
              Create your first measurement to get started
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
