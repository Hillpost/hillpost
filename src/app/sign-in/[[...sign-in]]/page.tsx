import { SignIn } from "@clerk/nextjs";
import { internalRedirect } from "@/lib/redirect-url";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const destination = internalRedirect(redirect_url) ?? "/dashboard";

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn forceRedirectUrl={destination} signUpForceRedirectUrl={destination} />
    </div>
  );
}
