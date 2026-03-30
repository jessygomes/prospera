type AppNavbarProps = {
  email?: string | null;
  displayName?: string | null;
  onSignOut?: () => Promise<void>;
};

export function AppNavbar({ email, displayName, onSignOut }: AppNavbarProps) {
  const resolvedName = displayName ?? email ?? "Utilisateur";
  const userInitial = resolvedName[0]?.toUpperCase() ?? "U";

  return (
    <nav className="sticky top-0 z-10 border-b border-border/60 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <span className="font-heading text-base font-bold tracking-tight text-foreground">
          Prospera
        </span>

        {onSignOut ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-brand-1 to-brand-2 text-xs font-bold text-white shadow-sm">
                {userInitial}
              </div>
              <span className="hidden text-sm text-foreground/60 sm:block">
                {email}
              </span>
            </div>

            <form action={onSignOut}>
              <button
                type="submit"
                className="rounded-lg border border-border/70 bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-brand-3/60 hover:text-foreground"
              >
                Déconnexion
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
