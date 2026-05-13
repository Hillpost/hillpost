import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuthUserId, getAuthUserId } from "./auth";

async function verifyOrganizer(
  ctx: MutationCtx,
  hackathonId: Id<"hackathons">,
  userId: string
) {
  const hackathon = await ctx.db.get(hackathonId);
  if (!hackathon) throw new Error("Hackathon not found");
  if (hackathon.organizerId === userId) return;
  const membership = await ctx.db
    .query("hackathonMembers")
    .withIndex("by_hackathonId_userId", (q) =>
      q.eq("hackathonId", hackathonId).eq("userId", userId)
    )
    .first();
  if (!membership || membership.role !== "organizer") {
    throw new Error("Only organizers can manage tracks");
  }
}

async function requireTeamInHackathon(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  hackathonId: Id<"hackathons">
) {
  const team = await ctx.db.get(teamId);
  if (!team || team.hackathonId !== hackathonId) {
    throw new Error("Team not found");
  }
  return team;
}

async function requireTrackInHackathon(
  ctx: MutationCtx,
  trackId: Id<"tracks">,
  hackathonId: Id<"hackathons">
) {
  const track = await ctx.db.get(trackId);
  if (!track || track.hackathonId !== hackathonId) {
    throw new Error("Track not found");
  }
  return track;
}

async function requireTracksInHackathon(
  ctx: MutationCtx,
  trackIds: Id<"tracks">[],
  hackathonId: Id<"hackathons">
) {
  const uniqueTrackIds = [...new Set(trackIds)];
  await Promise.all(
    uniqueTrackIds.map((trackId) =>
      requireTrackInHackathon(ctx, trackId, hackathonId)
    )
  );
  return uniqueTrackIds;
}

async function deleteTeamTrackAssignments(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  hackathonId: Id<"hackathons">
) {
  const existing = await ctx.db
    .query("teamTracks")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .collect();
  await Promise.all(
    existing
      .filter((tt) => tt.hackathonId === hackathonId)
      .map((tt) => ctx.db.delete(tt._id))
  );
}

async function verifyMembership(
  ctx: QueryCtx,
  hackathonId: Id<"hackathons">,
  userId: string | null
) {
  if (!userId) return false;
  const hackathon = await ctx.db.get(hackathonId);
  if (!hackathon) return false;
  if (hackathon.isPublic) return true;
  const membership = await ctx.db
    .query("hackathonMembers")
    .withIndex("by_hackathonId_userId", (q) =>
      q.eq("hackathonId", hackathonId).eq("userId", userId)
    )
    .first();
  return !!membership;
}

export const list = query({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, args) => {
    const hackathon = await ctx.db.get(args.hackathonId);
    if (!hackathon) return [];
    if (!hackathon.isPublic) {
      const userId = await getAuthUserId(ctx);
      const allowed = await verifyMembership(ctx, args.hackathonId, userId);
      if (!allowed) return [];
    }

    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
      .collect();

    const teamTracks = await ctx.db
      .query("teamTracks")
      .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
      .collect();

    return tracks
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((track) => ({
        ...track,
        teamIds: teamTracks
          .filter((tt) => tt.trackId === track._id)
          .map((tt) => tt.teamId),
      }));
  },
});

export const create = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await verifyOrganizer(ctx, args.hackathonId, userId);
    return await ctx.db.insert("tracks", {
      hackathonId: args.hackathonId,
      name: args.name,
      description: args.description,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    trackId: v.id("tracks"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const track = await ctx.db.get(args.trackId);
    if (!track) throw new Error("Track not found");
    await verifyOrganizer(ctx, track.hackathonId, userId);
    await ctx.db.patch(args.trackId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
    });
  },
});

export const remove = mutation({
  args: { trackId: v.id("tracks") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const track = await ctx.db.get(args.trackId);
    if (!track) throw new Error("Track not found");
    await verifyOrganizer(ctx, track.hackathonId, userId);

    const teamTracks = await ctx.db
      .query("teamTracks")
      .withIndex("by_trackId", (q) => q.eq("trackId", args.trackId))
      .collect();
    await Promise.all(teamTracks.map((tt) => ctx.db.delete(tt._id)));
    await ctx.db.delete(args.trackId);
  },
});

export const assignTeam = mutation({
  args: {
    trackId: v.id("tracks"),
    teamId: v.id("teams"),
    hackathonId: v.id("hackathons"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await verifyOrganizer(ctx, args.hackathonId, userId);
    await requireTeamInHackathon(ctx, args.teamId, args.hackathonId);
    await requireTrackInHackathon(ctx, args.trackId, args.hackathonId);

    const existing = await ctx.db
      .query("teamTracks")
      .withIndex("by_teamId_trackId", (q) =>
        q.eq("teamId", args.teamId).eq("trackId", args.trackId)
      )
      .first();
    if (existing) return;

    await ctx.db.insert("teamTracks", {
      teamId: args.teamId,
      trackId: args.trackId,
      hackathonId: args.hackathonId,
    });
  },
});

export const unassignTeam = mutation({
  args: {
    trackId: v.id("tracks"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const track = await ctx.db.get(args.trackId);
    if (!track) throw new Error("Track not found");
    await verifyOrganizer(ctx, track.hackathonId, userId);
    await requireTeamInHackathon(ctx, args.teamId, track.hackathonId);

    const existing = await ctx.db
      .query("teamTracks")
      .withIndex("by_teamId_trackId", (q) =>
        q.eq("teamId", args.teamId).eq("trackId", args.trackId)
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const setTeamTrackOrganizer = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    teamId: v.id("teams"),
    trackId: v.union(v.id("tracks"), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await verifyOrganizer(ctx, args.hackathonId, userId);
    await requireTeamInHackathon(ctx, args.teamId, args.hackathonId);
    if (args.trackId !== null) {
      await requireTrackInHackathon(ctx, args.trackId, args.hackathonId);
    }

    await deleteTeamTrackAssignments(ctx, args.teamId, args.hackathonId);

    if (args.trackId !== null) {
      await ctx.db.insert("teamTracks", {
        teamId: args.teamId,
        trackId: args.trackId,
        hackathonId: args.hackathonId,
      });
    }
  },
});

export const setTeamTracksOrganizer = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    teamId: v.id("teams"),
    trackIds: v.array(v.id("tracks")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await verifyOrganizer(ctx, args.hackathonId, userId);
    await requireTeamInHackathon(ctx, args.teamId, args.hackathonId);
    const uniqueTrackIds = await requireTracksInHackathon(
      ctx,
      args.trackIds,
      args.hackathonId
    );

    await deleteTeamTrackAssignments(ctx, args.teamId, args.hackathonId);

    await Promise.all(
      uniqueTrackIds.map((trackId) =>
        ctx.db.insert("teamTracks", {
          teamId: args.teamId,
          trackId,
          hackathonId: args.hackathonId,
        })
      )
    );
  },
});

export const setMyTeamTrack = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    trackId: v.union(v.id("tracks"), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const membership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("userId", userId)
      )
      .first();

    if (!membership || membership.role !== "competitor") {
      throw new Error("Only competitors can set team tracks");
    }
    if (!membership.teamId) {
      throw new Error("You must be on a team first");
    }
    await requireTeamInHackathon(ctx, membership.teamId, args.hackathonId);
    if (args.trackId !== null) {
      await requireTrackInHackathon(ctx, args.trackId, args.hackathonId);
    }

    await deleteTeamTrackAssignments(ctx, membership.teamId, args.hackathonId);

    if (args.trackId !== null) {
      await ctx.db.insert("teamTracks", {
        teamId: membership.teamId,
        trackId: args.trackId,
        hackathonId: args.hackathonId,
      });
    }
  },
});

export const setMyTeamTracks = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    trackIds: v.array(v.id("tracks")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const membership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("userId", userId)
      )
      .first();

    if (!membership || membership.role !== "competitor") {
      throw new Error("Only competitors can set team tracks");
    }
    if (!membership.teamId) {
      throw new Error("You must be on a team first");
    }
    await requireTeamInHackathon(ctx, membership.teamId, args.hackathonId);
    const uniqueTrackIds = await requireTracksInHackathon(
      ctx,
      args.trackIds,
      args.hackathonId
    );

    await deleteTeamTrackAssignments(ctx, membership.teamId, args.hackathonId);

    await Promise.all(
      uniqueTrackIds.map((trackId) =>
        ctx.db.insert("teamTracks", {
          teamId: membership.teamId!,
          trackId,
          hackathonId: args.hackathonId,
        })
      )
    );
  },
});
