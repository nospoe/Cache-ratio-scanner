import { Search } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        {icon ?? <Search className="w-6 h-6 text-gray-400" />}
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <span className="text-red-500 text-xl">!</span>
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">Something went wrong</h3>
      <p className="text-sm text-gray-500 max-w-md">{message}</p>
      {retry && (
        <button onClick={retry} className="mt-4 btn-secondary">
          Try again
        </button>
      )}
    </div>
  );
}
