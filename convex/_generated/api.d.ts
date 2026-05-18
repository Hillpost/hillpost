/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as categories from "../categories.js";
import type * as hackathons from "../hackathons.js";
import type * as leaderboard from "../leaderboard.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as scores from "../scores.js";
import type * as sponsors from "../sponsors.js";
import type * as submissions from "../submissions.js";
import type * as teams from "../teams.js";
import type * as tracks from "../tracks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  categories: typeof categories;
  hackathons: typeof hackathons;
  leaderboard: typeof leaderboard;
  members: typeof members;
  migrations: typeof migrations;
  scores: typeof scores;
  sponsors: typeof sponsors;
  submissions: typeof submissions;
  teams: typeof teams;
  tracks: typeof tracks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
