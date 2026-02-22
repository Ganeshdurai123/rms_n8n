import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';

export function Header() {
  const { user } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      {/* Page title area -- can be enhanced with breadcrumbs later */}
      <div />

      {/* User info */}
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {user.firstName} {user.lastName}
          </span>
          <Badge variant="outline" className="text-xs">
            {user.role.replace('_', ' ')}
          </Badge>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {user.firstName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
    </header>
  );
}
