import { useSelector } from 'react-redux';

const DashboardPage = () => {
  const { user } = useSelector((state) => state.auth);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Welcome, {user?.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        Role: <span className="font-medium capitalize">{user?.role}</span>
      </p>
      <p className="mt-4 text-sm text-gray-500">
        Dashboard cards and charts (members, revenue, expenses, expiring memberships) will be built in Phase 5.
      </p>
    </div>
  );
};

export default DashboardPage;
