import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin");
  }

  const membershipsCount = await prisma.workspaceMember.count({
    where: { userId },
  });

  if (membershipsCount === 0) {
    redirect("/onboarding/workspace");
  }

  redirect("/dashboard");
}
