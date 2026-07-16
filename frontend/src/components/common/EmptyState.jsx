const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    {Icon && (
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 dark:bg-gray-800 dark:text-gray-600">
        <Icon size={26} />
      </div>
    )}
    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
    {description && <p className="mt-1 max-w-xs text-sm text-gray-400">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;