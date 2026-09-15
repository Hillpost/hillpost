import { v } from "convex/values";
import {
  mutation as baseMutation,
  query as baseQuery,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./lib/functions";
import { requireAuthUserId, getAuthUserName } from "./auth";

const DEVICE_TTL_MS = 10 * 60 * 1000;
const POLL_INTERVAL_SECONDS = 2;
// SITE_URL is a Convex environment variable; set it on a dev deployment so the
// CLI opens the local web app instead of production.
const VERIFICATION_URL = `${process.env.SITE_URL ?? "https://hillpost.dev"}/cli/login`;
// No 0/O/1/I: these codes get read aloud and typed by hand.
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function secret(prefix: string): string {
  return prefix + base64url(randomBytes(32));
}

function randomUserCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += USER_CODE_ALPHABET[bytes[i] % USER_CODE_ALPHABET.length];
  }
  return code;
}

async function freshUserCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomUserCode();
    const existing = await ctx.db
      .query("cliDevices")
      .withIndex("by_userCode", (q) => q.eq("userCode", code))
      .first();
    if (!existing) return code;
  }
  throw new Error("Could not allocate a login code, please try again");
}

/**
 * Step 1 of the device flow. The CLI calls this without any credential and
 * shows the user `verificationUrl`, then polls `claimDevice` with `deviceCode`.
 */
export const startDeviceLogin = baseMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const userCode = await freshUserCode(ctx);
    const deviceCode = base64url(randomBytes(32));
    const expiresAt = now + DEVICE_TTL_MS;

    await ctx.db.insert("cliDevices", {
      deviceCode,
      userCode,
      status: "pending",
      expiresAt,
      createdAt: now,
    });

    return {
      deviceCode,
      userCode,
      verificationUrl: `${VERIFICATION_URL}?code=${userCode}`,
      expiresAt,
      interval: POLL_INTERVAL_SECONDS,
    };
  },
});

/** What the web page shows the signed-in user before they authorize. */
export const getDevice = baseQuery({
  args: { userCode: v.string() },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);
    const device = await ctx.db
      .query("cliDevices")
      .withIndex("by_userCode", (q) => q.eq("userCode", args.userCode))
      .first();
    if (!device) return null;
    return {
      status: device.status,
      createdAt: device.createdAt,
      expiresAt: device.expiresAt,
    };
  },
});

/** The signed-in user authorizes the waiting terminal. Mints the CLI token. */
export const approveDevice = baseMutation({
  args: {
    userCode: v.string(),
    userName: v.optional(v.string()),
    userImageUrl: v.optional(v.string()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const device = await ctx.db
      .query("cliDevices")
      .withIndex("by_userCode", (q) => q.eq("userCode", args.userCode))
      .first();
    if (!device) throw new Error("Unknown login code");
    if (device.status === "approved") {
      throw new Error("This login code has already been used");
    }
    if (device.expiresAt <= Date.now()) {
      await ctx.db.delete(device._id);
      throw new Error("This login code has expired");
    }

    const userName =
      args.userName?.trim() ||
      (await getAuthUserName(ctx)) ||
      "Hillpost user";
    const token = secret("hp_");

    await ctx.db.insert("cliTokens", {
      userId,
      userName,
      userImageUrl: args.userImageUrl,
      token,
      label: args.label?.trim() || "CLI",
      createdAt: Date.now(),
    });

    await ctx.db.patch(device._id, {
      status: "approved",
      token,
      userName,
    });

    return { ok: true as const };
  },
});

/** Step 2 of the device flow: the CLI polls this until the user authorizes. */
export const claimDevice = baseMutation({
  args: { deviceCode: v.string() },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("cliDevices")
      .withIndex("by_deviceCode", (q) => q.eq("deviceCode", args.deviceCode))
      .first();
    // Unknown codes look expired: the row is deleted once it is claimed.
    if (!device) return { status: "expired" as const };

    if (device.status === "approved" && device.token) {
      await ctx.db.delete(device._id);
      return {
        status: "approved" as const,
        token: device.token,
        userName: device.userName ?? "Hillpost user",
      };
    }

    if (device.expiresAt <= Date.now()) {
      await ctx.db.delete(device._id);
      return { status: "expired" as const };
    }

    return { status: "pending" as const };
  },
});

/** Who the caller is, plus the hackathons they belong to. */
export const whoami = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const members = await ctx.db
      .query("hackathonMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const memberships = [];
    for (const member of members) {
      const hackathon = await ctx.db.get(member.hackathonId);
      if (!hackathon) continue;
      memberships.push({
        hackathonId: member.hackathonId,
        name: hackathon.name,
        role: member.role,
        status: member.status,
        isActive: hackathon.isActive,
      });
    }

    return {
      userId,
      userName: (await getAuthUserName(ctx)) ?? members[0]?.userName ?? "",
      memberships,
    };
  },
});

export const listTokens = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const tokens = await ctx.db
      .query("cliTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return tokens.map((token) => ({
      _id: token._id,
      label: token.label,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt,
      preview: token.token.slice(0, 7),
    }));
  },
});

/** The plaintext token is returned once and never readable again. */
export const createToken = mutation({
  args: { label: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const token = secret("hp_");

    await ctx.db.insert("cliTokens", {
      userId,
      userName: (await getAuthUserName(ctx)) ?? "Hillpost user",
      token,
      label: args.label.trim() || "CLI",
      createdAt: Date.now(),
    });

    return { token };
  },
});

export const revokeToken = mutation({
  args: { tokenId: v.id("cliTokens") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const token = await ctx.db.get(args.tokenId);
    if (!token || token.userId !== userId) {
      throw new Error("Token not found");
    }
    await ctx.db.delete(args.tokenId);
    return { ok: true as const };
  },
});
