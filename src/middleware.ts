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
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
