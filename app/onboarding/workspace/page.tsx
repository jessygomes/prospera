import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { UI_MESSAGES } from "@/lib/messages/ui";
import { AppNavbar } from "@/components/shared/app-navbar";

import { WorkspaceOnboardingForm } from "./workspace-onboarding-form";
import { signOutAction } from "@/app/dashboard/actions";

export default async function WorkspaceOnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/signin");
  }

  const displayName =
    session.user?.name ?? session.user?.email ?? "Utilisateur";

  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        displayName={displayName}
        email={session.user?.email}
        onSignOut={signOutAction}
      />

      <main className="flex flex-1 flex-col items-center justify-center px-20 py-12">
        <div className="mb-10 text-center">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-brand-2/70">
            Onboarding
          </p>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            {UI_MESSAGES.workspace.onboarding.pageTitle}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-foreground/50">
            {UI_MESSAGES.workspace.onboarding.pageSubtitle}
          </p>
        </div>

        <WorkspaceOnboardingForm />
      </main>
    </div>
  );
}
