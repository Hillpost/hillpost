import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "./auth";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/** Returns the caller's membership for the given hackathon, or null if unauthenticated / not a member. */
async function getCallerMembership(ctx: QueryCtx, hackathonId: Id<"hackathons">, userId: string | null) {
  if (!userId) return null;
  return ctx.db
    .query("hackathonMembers")
    .withIndex("by_hackathonId_userId", (q) =>
      q.eq("hackathonId", hackathonId).eq("userId", userId)
    )
    .first();
}

export const get = query({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, args) => {
    const hackathon = await ctx.db.get(args.hackathonId);
    if (!hackathon) {
      return { entries: [], maxPossibleScore: 0, tracks: [], leaderboardHidden: false as const };
    }

    // Fetch userId and membership once; reuse for both access-gate and scores-visibility checks
    let userId: string | null = null;
    let membership: { role: string } | null = null;

    if (!hackathon.isPublic) {
      // Private hackathon: must be authenticated and a member
      userId = await getAuthUserId(ctx);
      if (!userId) return { entries: [], maxPossibleScore: 0, tracks: [], leaderboardHidden: false as const };
      membership = await getCallerMembership(ctx, args.hackathonId, userId);
      if (!membership) return { entries: [], maxPossibleScore: 0, tracks: [], leaderboardHidden: false as const };
    } else {
      // Public hackathon: still fetch userId/membership for scores-visibility check below
      userId = await getAuthUserId(ctx);
      if (userId) {
        membership = await getCallerMembership(ctx, args.hackathonId, userId);
      }
    }

    const scoresVisible = hackathon.scoresVisible !== false;
    if (!scoresVisible) {
      if (membership?.role === "competitor") {
        return { entries: [], maxPossibleScore: 0, tracks: [], leaderboardHidden: true as const };
      }
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
      .collect();

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
      .collect();

    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
      .collect();

    const allTeamTracks = await ctx.db
      .query("teamTracks")
      .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
      .collect();

    const teamTrackMap = new Map<string, string[]>();
    for (const tt of allTeamTracks) {
      const key = tt.teamId as string;
      if (!teamTrackMap.has(key)) teamTrackMap.set(key, []);
      teamTrackMap.get(key)!.push(tt.trackId as string);
    }

    const sortedCategories = categories.sort((a, b) => a.order - b.order);

    const leaderboard = await Promise.all(
      teams.map(async (team) => {
        // Get latest submission for this team
        const latestSubmission = await ctx.db
          .query("submissions")
          .withIndex("by_hackathonId_teamId", (q) =>
            q.eq("hackathonId", args.hackathonId).eq("teamId", team._id)
          )
          .order("desc")
          .first();

        const teamTrackIds = teamTrackMap.get(team._id as string) ?? [];
        const teamTracks = tracks.filter((t) => teamTrackIds.includes(t._id as string));

        if (!latestSubmission) {
          return {
            teamId: team._id,
            teamName: team.name,
            tracks: teamTracks,
            latestSubmission: null,
            averageScore: 0,
            overallScore: 0,
            categoryScores: sortedCategories.map((c) => ({
              categoryId: c._id,
              categoryName: c.name,
              maxScore: c.maxScore,
              averageScore: 0,
              judgeCount: 0,
            })),
            totalJudgeCount: 0,
            rank: 0,
          };
        }

        // Get scores for this submission for the current iteration only
        const currentIteration = latestSubmission.submissionCount;
        const scores = await ctx.db
          .query("scores")
          .withIndex("by_submissionId", (q) =>
            q.eq("submissionId", latestSubmission._id)
          )
          .filter((q) => q.eq(q.field("submissionCount"), currentIteration))
          .collect();

        // Compute per-category averages
        const categoryScores = sortedCategories.map((category) => {
          const categoryScoreEntries = scores.filter(
            (s) => s.categoryId === category._id
          );
          const judgeCount = categoryScoreEntries.length;
          const averageScore =
            judgeCount > 0
              ? categoryScoreEntries.reduce((sum, s) => sum + s.score, 0) /
                judgeCount
              : 0;

          return {
            categoryId: category._id,
            categoryName: category.name,
            maxScore: category.maxScore,
            averageScore,
            judgeCount,
          };
        });

        // Overall average score across all categories and judges
        const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
        const rawAverageScore = scores.length > 0 ? totalScore / scores.length : 0;
        let averageScore = rawAverageScore;

        // Overall score: sum of per-category averages (full tally)
        let overallScore = categoryScores.reduce(
          (sum, cs) => sum + cs.averageScore,
          0
        );

        // Apply threshold logic for resubmissions
        if (
          latestSubmission.baselineScore !== undefined &&
          latestSubmission.baselineJudgeCount !== undefined
        ) {
          const currentJudges = latestSubmission.judgedBy.length;
          const threshold = latestSubmission.baselineJudgeCount * 0.75;
          if (currentJudges < threshold) {
            averageScore = Math.max(averageScore, latestSubmission.baselineScore);
            overallScore = Math.max(overallScore, latestSubmission.baselineScore);
          }
        }

        // Count unique judges
        const uniqueJudges = new Set(scores.map((s) => s.judgeId));

        return {
          teamId: team._id,
          teamName: team.name,
          tracks: teamTracks,
          latestSubmission: {
            ...latestSubmission,
            judgedBy: [],
            submittedBy: "",
          },
          averageScore,
          overallScore,
          categoryScores,
          totalJudgeCount: uniqueJudges.size,
          rank: 0,
        };
      })
    );

    // Sort by overall score descending and assign ranks
    leaderboard.sort((a, b) => b.overallScore - a.overallScore);
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Max possible score (sum of all category maxScores)
    const maxPossibleScore = sortedCategories.reduce(
      (sum, c) => sum + c.maxScore,
      0
    );

    return { entries: leaderboard, maxPossibleScore, tracks, leaderboardHidden: false as const };
  },
});
