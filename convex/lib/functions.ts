import { v } from "convex/values";
import type { Auth, UserIdentity } from "convex/server";
import {
  customQuery,
  customMutation,
} from "convex-helpers/server/customFunctions";
import {
  query as baseQuery,
  mutation as baseMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";

/**
 * Optional credential accepted by every Hillpost function: a CLI token stands
 * in for a Clerk session, so handlers keep reading `ctx.auth` unchanged.
 */
const cliTokenArgs = { cliToken: v.optional(v.string()) };

async function authFor(
  ctx: QueryCtx | MutationCtx,
  cliToken: string | undefined
): Promise<Auth> {
  if (cliToken === undefined) return ctx.auth;

  const row = await ctx.db
    .query("cliTokens")
    .withIndex("by_token", (q) => q.eq("token", cliToken))
    .unique();
  if (!row) {
    throw new Error("Invalid CLI token");
  }

  const identity: UserIdentity = {
    subject: row.userId,
    name: row.userName,
    pictureUrl: row.userImageUrl,
    issuer: "hillpost-cli",
    tokenIdentifier: "hillpost-cli|" + row.userId,
  };

  return { getUserIdentity: async () => identity };
}

export const query = customQuery(baseQuery, {
  args: cliTokenArgs,
  input: async (ctx, { cliToken }) => ({
    ctx: { auth: await authFor(ctx, cliToken) },
    args: {},
  }),
});

export const mutation = customMutation(baseMutation, {
  args: cliTokenArgs,
  input: async (ctx, { cliToken }) => ({
    ctx: { auth: await authFor(ctx, cliToken) },
    args: {},
  }),
});
