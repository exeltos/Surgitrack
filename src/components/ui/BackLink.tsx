import type {ReactNode} from 'react';
import {Link, useNavigate} from 'react-router-dom';

/**
 * "Back to list": returns to wherever the user came from inside the app (a list, a Set, the
 * overview), so it opens as it was left; a record opened directly falls back to its own list.
 */
export default function BackLink({
  fallback,
  className,
  children,
}: {
  fallback: string;
  className?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Link
      to={fallback}
      className={className}
      onClick={e => {
        const index = (window.history.state as {idx?: number} | null)?.idx ?? 0;
        if (index > 0) {
          e.preventDefault();
          navigate(-1);
        }
      }}
    >
      {children}
    </Link>
  );
}
