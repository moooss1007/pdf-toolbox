import { Link, useRouterState } from "@tanstack/react-router";

const LINK =
  "text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

/** The app's pages, in the AppShell bar. */
export function AppNav() {
  const isAdmin = useRouterState({
    select: (state) => {
      const root = state.matches[0]?.loaderData;
      return Boolean(root && "isAdmin" in root && root.isAdmin);
    },
  });
  return (
    <nav className="flex min-w-0 items-center gap-3 overflow-x-auto">
      <Link to="/" className={LINK} activeOptions={{ exact: true }}>
        Files
      </Link>
      <Link to="/tools" className={LINK}>
        Tools
      </Link>
      <Link to="/tasks" className={LINK}>
        History
      </Link>
      {isAdmin ? (
        <Link to="/admin" className={LINK}>
          Admin
        </Link>
      ) : null}
    </nav>
  );
}
