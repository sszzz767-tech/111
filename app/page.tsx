export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600">Infinity Crypto AI Trading 🚀</h1>
      <p className="mt-4 text-lg text-gray-600">AI Trading System is running</p>
      <div className="mt-6 space-y-2">
        <p>API Endpoints:</p>
        <ul className="list-disc list-inside text-sm">
          <li><code>/api/sendMessage</code> - Trading webhook</li>
          <li><code>/api/card-image</code> - Generate trading cards</li>
          <li><code>/api/test</code> - Test endpoint</li>
        </ul>
      </div>
    </main>
  );
}
