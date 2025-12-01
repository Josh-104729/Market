function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Welcome to the Black Market Admin Panel</p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Users</h3>
            <p className="text-gray-600">Manage users</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Products</h3>
            <p className="text-gray-600">Manage products</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Orders</h3>
            <p className="text-gray-600">Manage orders</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

