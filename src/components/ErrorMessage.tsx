import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20"
    >
      <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1">
        <span>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-2 font-semibold underline underline-offset-2 hover:text-red-800"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
