import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { UI_MESSAGES } from "@/lib/messages/ui";
import { prisma } from "@/lib/prisma";

import { signOutAction } from "./actions";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin");
  }

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) {
    redirect("/onboarding/workspace");
  }

  return (
    <main className="relative min-h-screen overflow-hidden p-6">
      <div className="pointer-events-none absolute -left-16 top-12 h-52 w-52 rounded-full bg-[color:var(--brand-1)]/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-64 w-64 rounded-full bg-[color:var(--brand-5)]/20 blur-3xl" />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-5 shadow-[0_20px_70px_-35px_var(--brand-2)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[color:var(--brand-2)]">
                {UI_MESSAGES.dashboard.title}
              </h1>
              <p className="text-sm text-[color:var(--brand-4)]/90">
                {UI_MESSAGES.dashboard.connectedAsPrefix} {session.user?.email}
              </p>
            </div>
            <form action={signOutAction}>
              <button
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2 text-sm font-medium text-[color:var(--brand-2)] transition hover:border-[color:var(--brand-3)] hover:bg-[color:var(--brand-5)]/20"
                type="submit"
              >
                {UI_MESSAGES.dashboard.signOut}
              </button>
            </form>
          </div>
        </header>

        <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-5 shadow-[0_20px_70px_-35px_var(--brand-2)] backdrop-blur">
          <h2 className="mb-3 text-lg font-semibold text-[color:var(--brand-2)]">
            {UI_MESSAGES.dashboard.workspacesTitle}
          </h2>
          <ul className="space-y-2 text-sm">
            {memberships.map((membership) => (
              <li
                key={membership.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-3"
              >
                <div className="font-medium text-[color:var(--brand-2)]">
                  {membership.workspace.name}
                </div>
                <div className="text-[color:var(--brand-4)]/85">
                  {UI_MESSAGES.dashboard.rolePrefix} {membership.role}
                </div>
                <div className="text-[color:var(--brand-4)]/85">
                  {UI_MESSAGES.dashboard.idPrefix} {membership.workspace.id}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
