import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId, getAuthUserId } from "./auth";

// Sanitized judge profile fields that are safe to expose on public hackathon pages.
type PublicJudgeSummary = {
  _id: Id<"hackathonMembers">;
  userName: string;
  userImageUrl?: string;
};

function normalizeMemberDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Display name cannot be empty");
  }
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    throw new Error("Display name cannot contain control characters");
  }

  const normalized = trimmed.replace(/ {2,}/g, " ");
  if (normalized.length > 80) {
    throw new Error("Display name must be 80 characters or fewer");
  }
  return normalized;
}

export const getMyMembership = query({
  args: {
    hackathonId: v.id("hackathons"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    return await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("userId", userId)
      )
      .first();
  },
});

export const syncUserProfile = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    userImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const membership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("userId", userId)
      )
      .first();

    if (membership && membership.userImageUrl !== args.userImageUrl) {
      await ctx.db.patch(membership._id, { userImageUrl: args.userImageUrl });
    }
  },
});

export const listMembers = query({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const callerMembership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("userId", userId)
      )
      .first();

    if (!callerMembership || callerMembership.role !== "organizer") {
      return null;
    }

    return await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId", (q) =>
        q.eq("hackathonId", args.hackathonId)
      )
      .collect();
  },
});

export const listPublicJudges = query({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, args) => {
    const hackathon = await ctx.db.get(args.hackathonId);
    if (!hackathon || hackathon.isPublic !== true) {
      return [];
    }

    const judges = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_role", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("role", "judge")
      )
      .collect();

    return judges
      .filter((judge) => judge.status === "approved")
      .map<PublicJudgeSummary>(({ _id, userName, userImageUrl }) => ({
        _id,
        userName,
        userImageUrl,
      }));
  },
});

export const updateRole = mutation({
  args: {
    memberId: v.id("hackathonMembers"),
    role: v.union(
      v.literal("organizer"),
      v.literal("judge"),
      v.literal("competitor")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    // Verify caller is an organizer
    const callerMembership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q
          .eq("hackathonId", member.hackathonId)
          .eq("userId", userId)
      )
      .first();
    if (!callerMembership || callerMembership.role !== "organizer") {
      throw new Error("Only organizers can update roles");
    }

    await ctx.db.patch(args.memberId, { role: args.role });
    return args.memberId;
  },
});

export const updateStatus = mutation({
  args: {
    memberId: v.id("hackathonMembers"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    // Verify caller is an organizer
    const callerMembership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", member.hackathonId).eq("userId", userId)
      )
      .first();
    if (!callerMembership || callerMembership.role !== "organizer") {
      throw new Error("Only organizers can update member status");
    }

    await ctx.db.patch(args.memberId, { status: args.status });
    return args.memberId;
  },
});

export const updateDisplayName = mutation({
  args: {
    memberId: v.id("hackathonMembers"),
    userName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    const callerMembership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", member.hackathonId).eq("userId", userId)
      )
      .first();
    if (!callerMembership || callerMembership.role !== "organizer") {
      throw new Error("Only organizers can update member names");
    }

    const userName = normalizeMemberDisplayName(args.userName);
    await ctx.db.patch(args.memberId, { userName });
    return args.memberId;
  },
});

export const removeMember = mutation({
  args: {
    memberId: v.id("hackathonMembers"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    // Verify caller is an organizer
    const callerMembership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q
          .eq("hackathonId", member.hackathonId)
          .eq("userId", userId)
      )
      .first();
    if (!callerMembership || callerMembership.role !== "organizer") {
      throw new Error("Only organizers can remove members");
    }

    // Prevent removing yourself
    if (member.userId === userId) {
      throw new Error("You cannot remove yourself");
    }

    await ctx.db.delete(args.memberId);
  },
});

export const leaveHackathon = mutation({
  args: {
    hackathonId: v.id("hackathons"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const hackathon = await ctx.db.get(args.hackathonId);
    if (!hackathon) {
      throw new Error("Hackathon not found");
    }

    // The original creator cannot leave their own hackathon
    if (hackathon.organizerId === userId) {
      throw new Error("The creator cannot leave their own hackathon");
    }

    // Find the membership to delete
    const member = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("userId", userId)
      )
      .first();

    if (!member) {
      throw new Error("You are not a member of this hackathon");
    }

    await ctx.db.delete(member._id);
  },
});
