import type { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Retrieves the authenticated user's ID (Clerk subject) from the Convex auth context.
 * Returns null if the user is not authenticated.
 */
export async function getAuthUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return identity.subject;
}

/**
 * Retrieves the authenticated user's ID from the Convex auth context.
 * Throws an error if the user is not authenticated.
 */
export async function requireAuthUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

/**
 * Retrieves the authenticated user's display name from the Convex auth context.
 */
export async function getAuthUserName(
  ctx: QueryCtx | MutationCtx
): Promise<string | undefined> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return undefined;

  const fullName = identity.name?.trim();
  if (fullName) return fullName;

  const nameParts = [identity.givenName, identity.familyName]
    .map((part) => part?.trim())
    .filter(Boolean);
  if (nameParts.length > 0) return nameParts.join(" ");

  return (
    identity.nickname?.trim() ||
    identity.preferredUsername?.trim() ||
    undefined
  );
}
