import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
          <FileQuestion className="h-8 w-8 text-slate-400" aria-hidden />
        </div>
        <p className="text-5xl font-bold text-slate-900 tracking-tight">404</p>
        <h1 className="mt-3 text-lg font-semibold text-slate-800">Page Not Found</h1>
        <p className="mt-1 text-sm text-slate-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
