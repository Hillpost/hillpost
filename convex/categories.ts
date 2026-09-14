import { v } from "convex/values";
import { mutation, query } from "./lib/functions";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuthUserId, getAuthUserId } from "./auth";

async function verifyOrganizer(
  ctx: MutationCtx,
  hackathonId: Id<"hackathons">,
  userId: string
) {
  const membership = await ctx.db
    .query("hackathonMembers")
    .withIndex("by_hackathonId_userId", (q) =>
      q.eq("hackathonId", hackathonId).eq("userId", userId)
    )
    .first();
  if (!membership || membership.role !== "organizer") {
    throw new Error("Only organizers can manage categories");
  }
}

export const create = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    name: v.string(),
    description: v.string(),
    maxScore: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await verifyOrganizer(ctx, args.hackathonId, userId);

    // Get the next order number
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
      .collect();
    const maxOrder = existing.reduce((max, c) => Math.max(max, c.order), -1);

    return await ctx.db.insert("categories", {
      hackathonId: args.hackathonId,
      name: args.name,
      description: args.description,
      maxScore: args.maxScore,
      order: maxOrder + 1,
    });
  },
});

export const list = query({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, args) => {
    const hackathon = await ctx.db.get(args.hackathonId);
    if (!hackathon) return [];
    if (!hackathon.isPublic) {
      const userId = await getAuthUserId(ctx);
      if (!userId) return [];
      const membership = await ctx.db
        .query("hackathonMembers")
        .withIndex("by_hackathonId_userId", (q) =>
          q.eq("hackathonId", args.hackathonId).eq("userId", userId)
        )
        .first();
      if (!membership) return [];
    }
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
      .collect();
    return categories.sort((a, b) => a.order - b.order);
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    maxScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    await verifyOrganizer(ctx, category.hackathonId, userId);

    await ctx.db.patch(args.categoryId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.maxScore !== undefined && { maxScore: args.maxScore }),
    });
    return args.categoryId;
  },
});

export const remove = mutation({
  args: {
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    await verifyOrganizer(ctx, category.hackathonId, userId);

    await ctx.db.delete(args.categoryId);
  },
});

export const reorder = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    categoryIds: v.array(v.id("categories")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await verifyOrganizer(ctx, args.hackathonId, userId);

    await Promise.all(
      args.categoryIds.map((id, index) => ctx.db.patch(id, { order: index }))
    );
  },
});
