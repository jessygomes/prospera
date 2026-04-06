import { SignInForm } from "./signin-form";

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const { callbackUrl } = await searchParams;
  const safeCallbackUrl = callbackUrl?.startsWith("/")
    ? callbackUrl
    : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <SignInForm callbackUrl={safeCallbackUrl} />
    </main>
  );
}
