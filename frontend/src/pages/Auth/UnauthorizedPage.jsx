import { Link } from 'react-router-dom';

const UnauthorizedPage = () => (
  <div className="flex h-screen flex-col items-center justify-center gap-2">
    <h1 className="text-2xl font-semibold">403 - Not authorized</h1>
    <p className="text-sm text-gray-500">You don't have permission to view this page.</p>
    <Link to="/dashboard" className="mt-4 text-sm text-brand-600 hover:underline">
      Back to dashboard
    </Link>
  </div>
);

export default UnauthorizedPage;
