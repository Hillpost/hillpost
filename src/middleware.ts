import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/hacktober",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/leaderboard(.*)",
  "/discover(.*)",
  "/hackathon/:id",
  "/hackathon/(.*)/leaderboard",
  "/hackathon/:id/submission/:submissionId",
  "/hackathon/:id/submission/:submissionId/opengraph-image",
  "/hackathon/:id/leaderboard/opengraph-image",
  "/opengraph-image",
  "/twitter-image",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;
  // Send the user back where they were headed, query string and all, instead of
  // dropping them on the dashboard. /cli/login needs its ?code= to survive.
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect_url", request.url);
  await auth.protect({ unauthenticatedUrl: signInUrl.toString() });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
