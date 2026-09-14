import { v } from "convex/values";
import { mutation, query } from "./lib/functions";
import { requireAuthUserId, getAuthUserId } from "./auth";

export const create = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify user is a competitor in this hackathon
    const membership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("userId", userId)
      )
      .first();
    if (!membership) {
      throw new Error("You must be a member of this hackathon");
    }
    if (membership.role !== "competitor") {
      throw new Error("Only competitors can create teams");
    }

    const teamId = await ctx.db.insert("teams", {
      hackathonId: args.hackathonId,
      name: args.name,
      createdAt: Date.now(),
    });

    // Automatically assign the creator to this team
    await ctx.db.patch(membership._id, { teamId });

    return teamId;
  },
});

export const list = query({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
      .collect();

    // Enrich with member info
    const teamsWithMembers = await Promise.all(
      teams.map(async (team) => {
        const members = await ctx.db
          .query("hackathonMembers")
          .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
          .collect();
        return { ...team, members };
      })
    );

    return teamsWithMembers;
  },
});

export const get = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;

    const members = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
      .collect();

    return { ...team, members };
  },
});

export const getMyTeam = query({
  args: {
    hackathonId: v.id("hackathons"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const membership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("userId", userId)
      )
      .first();

    if (!membership || membership.role !== "competitor") {
      throw new Error("Unauthorized: Only competitors can view this");
    }

    if (!membership.teamId) {
      return null;
    }

    const team = await ctx.db.get(membership.teamId);
    if (!team) return null;

    const members = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
      .collect();

    return { ...team, members };
  },
});

export const joinTeam = mutation({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const membership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", team.hackathonId).eq("userId", userId)
      )
      .first();
    if (!membership) {
      throw new Error("You must be a member of this hackathon");
    }
    if (membership.role !== "competitor") {
      throw new Error("Only competitors can join teams");
    }

    if (membership.teamId) {
      throw new Error("You are already on a team. Leave your current team first.");
    }

    await ctx.db.patch(membership._id, { teamId: args.teamId });
    return args.teamId;
  },
});

export const leaveTeam = mutation({
  args: {
    hackathonId: v.id("hackathons"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const membership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("userId", userId)
      )
      .first();
    if (!membership) {
      throw new Error("You are not a member of this hackathon");
    }
    if (!membership.teamId) {
      throw new Error("You are not on a team");
    }

    await ctx.db.patch(membership._id, { teamId: undefined });
  },
});

export const updateTeamName = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const membership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", team.hackathonId).eq("userId", userId)
      )
      .first();

    if (!membership || membership.role !== "organizer") {
      throw new Error("Only organizers can update team names");
    }

    if (!args.name.trim()) {
      throw new Error("Team name cannot be empty");
    }

    await ctx.db.patch(args.teamId, { name: args.name.trim() });
    return args.teamId;
  },
});
