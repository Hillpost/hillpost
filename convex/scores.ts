import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuthUserId, getAuthUserId } from "./auth";

export const submit = mutation({
  args: {
    submissionId: v.id("submissions"),
    categoryId: v.id("categories"),
    score: v.number(),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const judgeId = await requireAuthUserId(ctx);

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    // Verify user is an approved judge or organizer in this hackathon
    const membership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q
          .eq("hackathonId", submission.hackathonId)
          .eq("userId", judgeId)
      )
      .first();
    if (
      !membership ||
      (membership.role !== "judge" && membership.role !== "organizer") ||
      (membership.role === "judge" && membership.status !== "approved")
    ) {
      throw new Error("Only approved judges and organizers can score submissions");
    }

    // Validate score against category max
    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }
    if (args.score < 1 || args.score > category.maxScore) {
      throw new Error(
        `Score must be between 1 and ${category.maxScore}`
      );
    }

    const currentIteration = submission.submissionCount ?? 1;

    // Upsert: check if this judge already scored this submission+category for the current iteration
    const existing = await ctx.db
      .query("scores")
      .withIndex("by_submissionId_categoryId_judgeId", (q) =>
        q
          .eq("submissionId", args.submissionId)
          .eq("categoryId", args.categoryId)
          .eq("judgeId", judgeId)
      )
      .filter((q) =>
        q.eq(q.field("submissionCount"), currentIteration)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        score: args.score,
        feedback: args.feedback,
        scoredAt: Date.now(),
      });

      // Ensure judge is in judgedBy array
      if (!submission.judgedBy.includes(judgeId)) {
        await ctx.db.patch(submission._id, {
          judgedBy: [...submission.judgedBy, judgeId],
        });
      }

      return existing._id;
    }

    const scoreId = await ctx.db.insert("scores", {
      submissionId: args.submissionId,
      categoryId: args.categoryId,
      judgeId,
      score: args.score,
      feedback: args.feedback,
      scoredAt: Date.now(),
      submissionCount: currentIteration,
    });

    if (!submission.judgedBy.includes(judgeId)) {
      await ctx.db.patch(submission._id, {
        judgedBy: [...submission.judgedBy, judgeId],
      });
    }

    return scoreId;
  },
});

export const getForSubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      return { scoresHidden: false as const, entries: [] };
    }

    const hackathon = await ctx.db.get(submission.hackathonId);
    if (!hackathon) return { scoresHidden: false as const, entries: [] };

    const userId = await getAuthUserId(ctx);

    // For private hackathons, require authentication and membership
    let membership: { role: string; status?: string } | null = null;
    if (!hackathon.isPublic) {
      if (!userId) return { scoresHidden: false as const, entries: [] };
      membership = await ctx.db
        .query("hackathonMembers")
        .withIndex("by_hackathonId_userId", (q) =>
          q.eq("hackathonId", submission.hackathonId).eq("userId", userId)
        )
        .first();
      if (!membership) return { scoresHidden: false as const, entries: [] };
    } else if (userId && hackathon.scoresVisible !== undefined && hackathon.scoresVisible !== true && hackathon.scoresVisible !== "all") {
      // Public hackathon with scores restricted: fetch membership to gate by role
      membership = await ctx.db
        .query("hackathonMembers")
        .withIndex("by_hackathonId_userId", (q) =>
          q.eq("hackathonId", submission.hackathonId).eq("userId", userId)
        )
        .first();
    }

    // Normalise scoresVisible: old booleans → new string literals
    const rawVisible = hackathon.scoresVisible;
    const visibilityMode: "all" | "judges" | "none" =
      rawVisible === false || rawVisible === "none"
        ? "none"
        : rawVisible === "judges"
          ? "judges"
          : "all";

    if (visibilityMode === "none") {
      if (membership?.role !== "organizer") {
        return { scoresHidden: true as const, entries: [] };
      }
    } else if (visibilityMode === "judges") {
      const canViewJudgeOnly =
        membership?.role === "organizer" ||
        (membership?.role === "judge" && membership.status === "approved");
      if (!canViewJudgeOnly) {
        return { scoresHidden: true as const, entries: [] };
      }
    }

    const currentIteration = submission?.submissionCount ?? 1;

    const allScores = await ctx.db
      .query("scores")
      .withIndex("by_submissionId", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .collect();

    const currentIterationScores = allScores.filter(
      (s) => (s.submissionCount ?? 1) === currentIteration
    );

    // Aggregate scores by category to avoid exposing per-judge rows
    const aggregatesByCategory = new Map<
      string,
      { categoryId: Id<"categories">; totalScore: number; judgeCount: number }
    >();

    for (const score of currentIterationScores) {
      const key = score.categoryId as Id<"categories">;
      const existing = aggregatesByCategory.get(key);
      if (existing) {
        existing.totalScore += score.score;
        existing.judgeCount += 1;
      } else {
        aggregatesByCategory.set(key, {
          categoryId: key,
          totalScore: score.score,
          judgeCount: 1,
        });
      }
    }

    return {
      scoresHidden: false as const,
      entries: Array.from(aggregatesByCategory.values()).map(
        ({ categoryId, totalScore, judgeCount }) => ({
          categoryId,
          averageScore: judgeCount > 0 ? totalScore / judgeCount : 0,
          judgeCount,
        })
      ),
    };
  },
});

export const getMyScoresForSubmission = query({
  args: {
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const submission = await ctx.db.get(args.submissionId);
    const currentIteration = submission?.submissionCount ?? 1;

    const allScores = await ctx.db
      .query("scores")
      .withIndex("by_submissionId", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .collect();

    return allScores.filter(
      (s) =>
        s.judgeId === userId &&
        (s.submissionCount ?? 1) === currentIteration
    );
  },
});

/**
 * Returns scores/feedback for a submission grouped by iteration and judge.
 * - Organizers see judge names.
 * - Competitors and judges see anonymous labels ("Judge 1", "Judge 2", …)
 *   and judge IDs are NOT sent to the client.
 * - Returns all iterations so competitors can see score history.
 * - When feedbackVisible is false or scoresVisible is false on the hackathon,
 *   competitors receive
 *   `{ feedbackHidden: true }` (no feedback data is included in the response at all).
 */
export const getFeedbackForSubmission = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return null;

    // Determine caller's role
    const membership = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", submission.hackathonId).eq("userId", userId)
      )
      .first();
    if (!membership) return null;

    // Only approved judges are allowed to access feedback as judges.
    if (membership.role === "judge" && membership.status !== "approved") {
      return null;
    }

    const isOrganizer = membership.role === "organizer";
    const isJudge = membership.role === "judge";

    // Competitors (and any non-organizer/non-judge roles) may only see
    // feedback for submissions from their own team.
    if (!isOrganizer && !isJudge) {
      if (!membership.teamId || membership.teamId !== submission.teamId) {
        return null;
      }
    }

    // Fetch the hackathon to check feedbackVisible setting.
    const hackathon = await ctx.db.get(submission.hackathonId);
    const feedbackVisible = hackathon?.feedbackVisible !== false; // undefined defaults to true
    // Normalise scoresVisible
    const rawVisible = hackathon?.scoresVisible;
    const visibilityMode: "all" | "judges" | "none" =
      rawVisible === false || rawVisible === "none"
        ? "none"
        : rawVisible === "judges"
          ? "judges"
          : "all";

    // Competitors do not receive feedback when feedback is disabled or scores are not public.
    if (!isOrganizer && !isJudge) {
      if (!feedbackVisible || visibilityMode !== "all") {
        return { feedbackHidden: true as const };
      }
    }
    // Judges don't see feedback when visibility is "none"
    if (isJudge && visibilityMode === "none") {
      return { feedbackHidden: true as const };
    }

    // Fetch all scores for this submission (all iterations)
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_submissionId", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .collect();

    if (scores.length === 0) {
      return {
        iterations: [],
        categories: [],
        currentSubmissionCount: submission.submissionCount,
      };
    }

    // Fetch categories for this hackathon
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_hackathonId", (q) =>
        q.eq("hackathonId", submission.hackathonId)
      )
      .collect();
    const sortedCategories = categories.sort((a, b) => a.order - b.order);

    // Group scores by iteration (submissionCount)
    const iterationMap = new Map<
      number,
      Array<{
        judgeId: string;
        categoryId: Id<"categories">;
        score: number;
        feedback?: string;
        scoredAt: number;
      }>
    >();
    for (const s of scores) {
      const iter = s.submissionCount ?? 1;
      if (!iterationMap.has(iter)) {
        iterationMap.set(iter, []);
      }
      iterationMap.get(iter)!.push({
        judgeId: s.judgeId,
        categoryId: s.categoryId,
        score: s.score,
        feedback: s.feedback,
        scoredAt: s.scoredAt,
      });
    }

    // Collect all unique judge IDs across all iterations for stable numbering
    const allJudgeIds = new Set<string>();
    for (const iterScores of iterationMap.values()) {
      for (const s of iterScores) {
        allJudgeIds.add(s.judgeId);
      }
    }
    // Stable ordering by earliest scoredAt across all iterations
    const sortedJudgeIds = [...allJudgeIds].sort((a, b) => {
      const aMin = Math.min(
        ...scores.filter((s) => s.judgeId === a).map((s) => s.scoredAt)
      );
      const bMin = Math.min(
        ...scores.filter((s) => s.judgeId === b).map((s) => s.scoredAt)
      );
      return aMin - bMin;
    });

    // For organizers, resolve judge names
    let judgeNameMap: Map<string, string> | undefined;
    if (isOrganizer) {
      judgeNameMap = new Map();
      const members = await ctx.db
        .query("hackathonMembers")
        .withIndex("by_hackathonId", (q) =>
          q.eq("hackathonId", submission.hackathonId)
        )
        .collect();
      for (const member of members) {
        judgeNameMap.set(member.userId, member.userName);
      }
    }

    // Build a label map (same label for a judge across all iterations)
    const judgeLabelMap = new Map<string, string>();
    sortedJudgeIds.forEach((jid, index) => {
      judgeLabelMap.set(
        jid,
        isOrganizer
          ? (judgeNameMap!.get(jid) ?? `Judge ${index + 1}`)
          : `Judge ${index + 1}`
      );
    });

    // Build iterations array sorted by submissionCount descending (most recent first)
    const iterationNumbers = [...iterationMap.keys()].sort((a, b) => b - a);

    const iterations = iterationNumbers.map((iterNum) => {
      const iterScores = iterationMap.get(iterNum)!;

      // Group by judgeId within this iteration
      const judgeScoresMap = new Map<
        string,
        Array<{ categoryId: Id<"categories">; score: number; feedback?: string }>
      >();
      for (const s of iterScores) {
        if (!judgeScoresMap.has(s.judgeId)) {
          judgeScoresMap.set(s.judgeId, []);
        }
        judgeScoresMap.get(s.judgeId)!.push({
          categoryId: s.categoryId,
          score: s.score,
          feedback: s.feedback,
        });
      }

      // Build judge entries for this iteration using global stable ordering
      const judgeIdsInIter = sortedJudgeIds.filter((jid) =>
        judgeScoresMap.has(jid)
      );

      const judges = judgeIdsInIter.map((jid) => {
        const judgeScores = judgeScoresMap.get(jid)!;
        const categoryScores = sortedCategories.map((cat) => {
          const entry = judgeScores.find((s) => s.categoryId === cat._id);
          return {
            categoryId: cat._id,
            score: entry?.score ?? null,
            feedback: entry?.feedback ?? null,
          };
        });

        return {
          label: judgeLabelMap.get(jid)!,
          categoryScores,
        };
      });

      return {
        submissionCount: iterNum,
        judges,
      };
    });

    return {
      iterations,
      categories: sortedCategories.map((c) => ({
        _id: c._id,
        name: c.name,
        maxScore: c.maxScore,
      })),
      currentSubmissionCount: submission.submissionCount,
    };
  },
});
