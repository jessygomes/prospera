import { redirect } from "next/navigation";
import Image from "next/image";

import { auth } from "@/auth";
import { UI_MESSAGES } from "@/lib/messages/ui";

import { WorkspaceOnboardingForm } from "./workspace-onboarding-form";

export default async function WorkspaceOnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/signin");
  }

  return (
    <main className="relative min-h-screen overflow-hidden p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col justify-center">
        {/* <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <Image
            src="/logo.png"
            alt=""
            width={1200}
            height={360}
            priority
            aria-hidden
            className="h-auto w-[min(92vw,1000px)] opacity-5"
          />
        </div> */}

        <div className="mb-6 w-full max-w-3xl text-center">
          <h1 className="text-2xl font-semibold text-brand-5">
            {UI_MESSAGES.workspace.onboarding.pageTitle}
          </h1>
          <p className="mt-2 text-sm text-brand-5/70">
            {UI_MESSAGES.workspace.onboarding.pageSubtitle}
          </p>
        </div>

        <WorkspaceOnboardingForm />
      </div>
    </main>
  );
}
