import { SignUp } from "@clerk/nextjs";
import { internalRedirect } from "@/lib/redirect-url";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp forceRedirectUrl={internalRedirect(redirect_url) ?? "/dashboard"} />
    </div>
  );
}
