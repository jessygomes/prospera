import { SignUpForm } from "./signup-form";
import Image from "next/image";

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-[color:var(--brand-3)]/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-10 h-56 w-56 rounded-full bg-[color:var(--brand-5)]/20 blur-3xl" /> */}
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

      <div className="relative z-10 flex flex-col items-center">
        <SignUpForm />
      </div>
    </main>
  );
}
