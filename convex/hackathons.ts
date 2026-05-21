import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuthUserId, getAuthUserId, getAuthUserName } from "./auth";

function sanitizeDisplayName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    throw new Error("Display name cannot contain control characters");
  }

  const normalized = trimmed.replace(/ {2,}/g, " ");
  if (normalized.length > 80) {
    throw new Error("Display name must be 80 characters or fewer");
  }
  return normalized;
}

async function requireDisplayName(
  ctx: Parameters<typeof getAuthUserName>[0],
  providedName: string | undefined
): Promise<string> {
  const userName =
    sanitizeDisplayName(providedName) ??
    sanitizeDisplayName(await getAuthUserName(ctx));
  if (!userName) {
    throw new Error("Please enter your name to continue");
  }
  return userName;
}

function generateJoinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function validateSubmissionWindow(args: {
  startDate: number;
  submissionsStartDate: number;
  submissionsEndDate: number;
  endDate: number;
}) {
  if (args.endDate < args.startDate) {
    throw new Error("End date must be on or after start date");
  }
  if (args.submissionsStartDate < args.startDate) {
    throw new Error("Submissions cannot open before the hackathon starts");
  }
  if (args.submissionsEndDate > args.endDate) {
    throw new Error("Submissions cannot close after the hackathon ends");
  }
  if (args.submissionsStartDate > args.submissionsEndDate) {
    throw new Error("Submissions cannot close before they open");
  }
}

function stripJoinCodes<T extends { competitorJoinCode: string; judgeJoinCode: string }>(
  hackathon: T
): Omit<T, "competitorJoinCode" | "judgeJoinCode"> {
  const sanitized: Partial<T> = { ...hackathon };
  delete sanitized.competitorJoinCode;
  delete sanitized.judgeJoinCode;
  return sanitized as Omit<T, "competitorJoinCode" | "judgeJoinCode">;
}

async function requireOrganizerMembership(
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
  if (
    !membership ||
    membership.role !== "organizer" ||
    membership.status !== "approved"
  ) {
    throw new Error("Only organizers can manage hackathons");
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    startDate: v.number(),
    submissionsStartDate: v.optional(v.number()),
    submissionsEndDate: v.optional(v.number()),
    endDate: v.number(),
    submissionFrequencyMinutes: v.optional(v.number()),
    openGraphImageUrl: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    userName: v.optional(v.string()),
    userImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const userName = await requireDisplayName(ctx, args.userName);

    let competitorJoinCode = generateJoinCode();
    let judgeJoinCode = generateJoinCode();

    // Ensure uniqueness for both
    const ensureUniqueCompetitor = async (code: string): Promise<string> => {
      let uniqueCode = code;
      let existing = await ctx.db
        .query("hackathons")
        .withIndex("by_competitorJoinCode", (q) => q.eq("competitorJoinCode", uniqueCode))
        .first();
      while (existing) {
        uniqueCode = generateJoinCode();
        existing = await ctx.db
          .query("hackathons")
          .withIndex("by_competitorJoinCode", (q) => q.eq("competitorJoinCode", uniqueCode))
          .first();
      }
      return uniqueCode;
    };

    const ensureUniqueJudge = async (code: string): Promise<string> => {
      let uniqueCode = code;
      let existing = await ctx.db
        .query("hackathons")
        .withIndex("by_judgeJoinCode", (q) => q.eq("judgeJoinCode", uniqueCode))
        .first();
      while (existing) {
        uniqueCode = generateJoinCode();
        existing = await ctx.db
          .query("hackathons")
          .withIndex("by_judgeJoinCode", (q) => q.eq("judgeJoinCode", uniqueCode))
          .first();
      }
      return uniqueCode;
    };

    competitorJoinCode = await ensureUniqueCompetitor(competitorJoinCode);
    judgeJoinCode = await ensureUniqueJudge(judgeJoinCode);

    const sanitizedOpenGraphImageUrl =
      args.openGraphImageUrl === undefined
        ? undefined
        : sanitizeUrl(args.openGraphImageUrl);

    if (sanitizedOpenGraphImageUrl === null) {
      throw new Error("Banner image URL must be a valid http(s) URL");
    }

    const submissionsStartDate = args.submissionsStartDate ?? args.startDate;
    const submissionsEndDate = args.submissionsEndDate ?? args.endDate;
    validateSubmissionWindow({
      startDate: args.startDate,
      submissionsStartDate,
      submissionsEndDate,
      endDate: args.endDate,
    });

    const now = Date.now();
    const hackathonId = await ctx.db.insert("hackathons", {
      name: args.name,
      description: args.description,
      organizerId: userId,
      startDate: args.startDate,
      submissionsStartDate,
      submissionsEndDate,
      endDate: args.endDate,
      submissionFrequencyMinutes: args.submissionFrequencyMinutes ?? 60,
      isActive: true,
      competitorJoinCode,
      judgeJoinCode,
      ...(sanitizedOpenGraphImageUrl !== undefined && {
        openGraphImageUrl: sanitizedOpenGraphImageUrl,
      }),
      isPublic: args.isPublic ?? false,
      createdAt: now,
    });

    // Auto-add creator as organizer member
    await ctx.db.insert("hackathonMembers", {
      hackathonId,
      userId,
      userName,
      userImageUrl: args.userImageUrl,
      role: "organizer",
      status: "approved",
      joinedAt: now,
    });

    return hackathonId;
  },
});

export const get = query({
  args: { hackathonId: v.id("hackathons") },
  handler: async (ctx, args) => {
    const hackathon = await ctx.db.get(args.hackathonId);
    if (!hackathon) return null;

    const userId = await getAuthUserId(ctx);

    // For private hackathons, only members may see any data
    if (!hackathon.isPublic) {
      if (!userId) return null;
      const membership = await ctx.db
        .query("hackathonMembers")
        .withIndex("by_hackathonId_userId", (q) =>
          q.eq("hackathonId", args.hackathonId).eq("userId", userId)
        )
        .first();
      if (!membership) return null;

      // Resolve join codes from the already-fetched membership
      const rest = stripJoinCodes(hackathon);
      return {
        ...rest,
        competitorJoinCode:
          membership.role === "organizer" || membership.role === "competitor"
            ? hackathon.competitorJoinCode
            : undefined,
        judgeJoinCode:
          membership.role === "organizer" ? hackathon.judgeJoinCode : undefined,
      };
    }

    // Public hackathon — expose join codes to authenticated members only
    let competitorJoinCode: string | undefined;
    let judgeJoinCode: string | undefined;

    if (userId) {
      const membership = await ctx.db
        .query("hackathonMembers")
        .withIndex("by_hackathonId_userId", (q) =>
          q.eq("hackathonId", args.hackathonId).eq("userId", userId)
        )
        .first();

      if (membership?.role === "organizer") {
        competitorJoinCode = hackathon.competitorJoinCode;
        judgeJoinCode = hackathon.judgeJoinCode;
      } else if (membership?.role === "competitor") {
        competitorJoinCode = hackathon.competitorJoinCode;
      }
    }

    // Return a consistent shape; hidden codes are undefined
    const rest = stripJoinCodes(hackathon);
    return { ...rest, competitorJoinCode, judgeJoinCode };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // Unauthenticated callers only see active/upcoming public hackathons
      // Use the index to avoid fetching private hackathons entirely
      const now = Date.now();
      const publicHackathons = await ctx.db
        .query("hackathons")
        .withIndex("by_isPublic", (q) => q.eq("isPublic", true))
        .collect();
      return publicHackathons
        .filter((h) => h.endDate >= now)
        .map((hackathon) => stripJoinCodes(hackathon));
    }
    const hackathons = await ctx.db.query("hackathons").collect();
    // Strip all join codes from the authenticated list
    return hackathons.map((hackathon) => stripJoinCodes(hackathon));
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const memberships = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const hackathons = await Promise.all(
      memberships.map(async (m) => {
        const hackathon = await ctx.db.get(m.hackathonId);
        if (!hackathon) return null;

        const { competitorJoinCode, judgeJoinCode, ...rest } = hackathon;

        // Return a consistent shape for all roles; hide codes by setting them to undefined.
        if (m.role === "organizer") {
          // Organizers see both join codes.
          return {
            ...rest,
            competitorJoinCode,
            judgeJoinCode,
            myRole: m.role,
          };
        }

        if (m.role === "competitor") {
          // Competitors see only competitorJoinCode.
          return {
            ...rest,
            competitorJoinCode,
            judgeJoinCode: undefined,
            myRole: m.role,
          };
        }

        // Judges see neither join code.
        return {
          ...rest,
          competitorJoinCode: undefined,
          judgeJoinCode: undefined,
          myRole: m.role,
        };
      })
    );

    return hackathons.filter(Boolean);
  },
});

export const update = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    submissionsStartDate: v.optional(v.number()),
    submissionsEndDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    submissionFrequencyMinutes: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    openGraphImageUrl: v.optional(v.union(v.string(), v.null())),
    isPublic: v.optional(v.boolean()),
    feedbackVisible: v.optional(v.boolean()),
    scoresVisible: v.optional(v.union(v.literal("all"), v.literal("judges"), v.literal("none"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const hackathon = await ctx.db.get(args.hackathonId);
    if (!hackathon) {
      throw new Error("Hackathon not found");
    }

    await requireOrganizerMembership(ctx, args.hackathonId, userId);

    const sanitizedOpenGraphImageUrl =
      args.openGraphImageUrl === undefined
        ? undefined
        : args.openGraphImageUrl === null
        ? null
        : sanitizeUrl(args.openGraphImageUrl);

    if (sanitizedOpenGraphImageUrl === null && args.openGraphImageUrl !== null && args.openGraphImageUrl !== undefined) {
      throw new Error("Invalid openGraphImageUrl");
    }

    const hasSubmissionsStartDateArg = Object.prototype.hasOwnProperty.call(args, "submissionsStartDate");
    const hasSubmissionsEndDateArg = Object.prototype.hasOwnProperty.call(args, "submissionsEndDate");
    const nextStartDate = args.startDate ?? hackathon.startDate;
    const nextEndDate = args.endDate ?? hackathon.endDate;
    const nextSubmissionsStartDate = hasSubmissionsStartDateArg
      ? (args.submissionsStartDate ?? nextStartDate)
      : (hackathon.submissionsStartDate ?? nextStartDate);
    const nextSubmissionsEndDate = hasSubmissionsEndDateArg
      ? (args.submissionsEndDate ?? nextEndDate)
      : (hackathon.submissionsEndDate ?? nextEndDate);
    validateSubmissionWindow({
      startDate: nextStartDate,
      submissionsStartDate: nextSubmissionsStartDate,
      submissionsEndDate: nextSubmissionsEndDate,
      endDate: nextEndDate,
    });

    await ctx.db.patch(args.hackathonId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.startDate !== undefined && { startDate: args.startDate }),
      ...(hasSubmissionsStartDateArg && { submissionsStartDate: args.submissionsStartDate ?? nextStartDate }),
      ...(hasSubmissionsEndDateArg && { submissionsEndDate: args.submissionsEndDate ?? nextEndDate }),
      ...(args.endDate !== undefined && { endDate: args.endDate }),
      ...(args.submissionFrequencyMinutes !== undefined && {
        submissionFrequencyMinutes: args.submissionFrequencyMinutes,
      }),
      ...(args.isActive !== undefined && { isActive: args.isActive }),
      ...(args.openGraphImageUrl !== undefined && {
        openGraphImageUrl:
          sanitizedOpenGraphImageUrl === null ? undefined : sanitizedOpenGraphImageUrl,
      }),
      ...(args.isPublic !== undefined && { isPublic: args.isPublic }),
      ...(args.feedbackVisible !== undefined && { feedbackVisible: args.feedbackVisible }),
      ...(args.scoresVisible !== undefined && { scoresVisible: args.scoresVisible }),
    });
    return args.hackathonId;
  },
});

export const remove = mutation({
  args: {
    hackathonId: v.id("hackathons"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const hackathon = await ctx.db.get(args.hackathonId);
    if (!hackathon) {
      throw new Error("Hackathon not found");
    }

    await requireOrganizerMembership(ctx, args.hackathonId, userId);

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
      .collect();

    const scoresBySubmission = await Promise.all(
      submissions.map((submission) =>
        ctx.db
          .query("scores")
          .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
          .collect()
      )
    );
    const scoreIds = scoresBySubmission.flat().map((score) => score._id);
    await Promise.all(scoreIds.map((scoreId) => ctx.db.delete(scoreId)));
    await Promise.all(submissions.map((submission) => ctx.db.delete(submission._id)));

    const [teams, categories, sponsors, members] = await Promise.all([
      ctx.db
        .query("teams")
        .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
        .collect(),
      ctx.db
        .query("categories")
        .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
        .collect(),
      ctx.db
        .query("sponsors")
        .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
        .collect(),
      ctx.db
        .query("hackathonMembers")
        .withIndex("by_hackathonId", (q) => q.eq("hackathonId", args.hackathonId))
        .collect(),
    ]);

    await Promise.all([
      ...teams.map((team) => ctx.db.delete(team._id)),
      ...categories.map((category) => ctx.db.delete(category._id)),
      ...sponsors.map((sponsor) => ctx.db.delete(sponsor._id)),
      ...members.map((member) => ctx.db.delete(member._id)),
    ]);

    await ctx.db.delete(args.hackathonId);
  },
});

export const join = mutation({
  args: {
    joinCode: v.string(),
    userName: v.optional(v.string()),
    userImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const userName = await requireDisplayName(ctx, args.userName);

    let hackathon = await ctx.db
      .query("hackathons")
      .withIndex("by_competitorJoinCode", (q) => q.eq("competitorJoinCode", args.joinCode))
      .first();
    
    let role: "competitor" | "judge" = "competitor";
    let status: "approved" | "pending" | "rejected" = "approved";

    if (!hackathon) {
      hackathon = await ctx.db
        .query("hackathons")
        .withIndex("by_judgeJoinCode", (q) => q.eq("judgeJoinCode", args.joinCode))
        .first();
      role = "judge";
      status = "pending";
    }

    if (!hackathon) {
      throw new Error("Invalid join code");
    }

    // Check if already a member
    const existing = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", hackathon._id).eq("userId", userId)
      )
      .first();
    if (existing) {
      return { hackathonId: hackathon._id, alreadyMember: true };
    }

    await ctx.db.insert("hackathonMembers", {
      hackathonId: hackathon._id,
      userId,
      userName,
      userImageUrl: args.userImageUrl,
      role,
      status,
      joinedAt: Date.now(),
    });

    return { hackathonId: hackathon._id, alreadyMember: false };
  },
});

export const joinPublic = mutation({
  args: {
    hackathonId: v.id("hackathons"),
    userName: v.optional(v.string()),
    userImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const userName = await requireDisplayName(ctx, args.userName);

    const hackathon = await ctx.db.get(args.hackathonId);
    if (
      !hackathon ||
      hackathon.isPublic !== true ||
      Date.now() > hackathon.endDate
    ) {
      throw new Error("Hackathon is not publicly joinable");
    }

    const existing = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_hackathonId_userId", (q) =>
        q.eq("hackathonId", args.hackathonId).eq("userId", userId)
      )
      .first();
    if (existing) {
      return { hackathonId: args.hackathonId, alreadyMember: true };
    }

    await ctx.db.insert("hackathonMembers", {
      hackathonId: args.hackathonId,
      userId,
      userName,
      userImageUrl: args.userImageUrl,
      role: "competitor",
      status: "approved",
      joinedAt: Date.now(),
    });

    return { hackathonId: args.hackathonId, alreadyMember: false };
  },
});

export const getByJoinCode = query({
  args: { joinCode: v.string() },
  handler: async (ctx, args) => {
    let hackathon = await ctx.db
      .query("hackathons")
      .withIndex("by_competitorJoinCode", (q) => q.eq("competitorJoinCode", args.joinCode))
      .first();
    let role: "competitor" | "judge" = "competitor";
    if (!hackathon) {
      hackathon = await ctx.db
        .query("hackathons")
        .withIndex("by_judgeJoinCode", (q) => q.eq("judgeJoinCode", args.joinCode))
        .first();
      role = "judge";
    }
    if (!hackathon) return null;
    // Strip both join codes — this query is used pre-join for display only
    const rest = stripJoinCodes(hackathon);
    return { ...rest, role };
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const hackathons = await ctx.db
      .query("hackathons")
      .withIndex("by_isPublic", (q) => q.eq("isPublic", true))
      .collect();
    return hackathons
      .filter((h) => h.endDate >= now)
      .map((hackathon) => stripJoinCodes(hackathon));
  },
});
