"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

export default function LeaderboardPage() {
  const params = useParams();
  const hackathonId = params.id as Id<"hackathons">;

  const hackathon = useQuery(api.hackathons.get, { hackathonId });
  const leaderboardData = useQuery(api.leaderboard.get, { hackathonId });
  const membership = useQuery(api.members.getMyMembership, { hackathonId });
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  if (hackathon === undefined || leaderboardData === undefined || membership === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-96 border border-[#1F1F1F] bg-[#0A0A0A] flex items-center justify-center">
          <span className="text-xs text-[#555555] uppercase tracking-widest cursor-blink">
            ▓▓▓░░░ LOADING...
          </span>
        </div>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8 text-center">
          <p className="text-sm text-[#555555] uppercase tracking-wide">Hackathon not found</p>
        </div>
      </div>
    );
  }

  if (leaderboardData.leaderboardHidden) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/hackathon/${hackathonId}`}
            className="mb-4 inline-flex items-center gap-1 text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Hackathon
          </Link>
        </div>
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8 text-center">
          <p className="text-sm text-[#555555] uppercase tracking-wider">LEADERBOARD HIDDEN</p>
          <p className="mt-2 text-xs text-[#333333] uppercase tracking-wide">
            The organizer has disabled leaderboard visibility for competitors.
          </p>
        </div>
      </div>
    );
  }

  const getRankLabel = (rank: number) => {
    if (rank === 1) return "#1";
    if (rank === 2) return "#2";
    if (rank === 3) return "#3";
    return `#${rank}`;
  };

  const getRankRowClass = (rank: number) => {
    switch (rank) {
      case 1:
        return "border-b border-[#FF6600]/20 bg-[#FF660008]";
      case 2:
        return "border-b border-[#1F1F1F]";
      case 3:
        return "border-b border-[#1F1F1F]";
      default:
        return "border-b border-[#1F1F1F]";
    }
  };

  const { entries: allEntries, maxPossibleScore, tracks } = leaderboardData;
  const leaderboard = selectedTrackId
    ? allEntries.filter((e) => e.tracks.some((t) => (t._id as string) === selectedTrackId))
    : allEntries;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/hackathon/${hackathonId}`}
          className="mb-4 inline-flex items-center gap-1 text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Hackathon
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {!membership ? (
              <>
                <h1 className="text-2xl font-bold text-white uppercase tracking-wide">
                  {hackathon.name}
                </h1>
                <p className="text-xs text-[#555555] uppercase tracking-wider mt-1">
                  LIVE LEADERBOARD
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white uppercase tracking-wide">
                  LIVE LEADERBOARD
                </h1>
                <p className="text-xs text-[#555555] uppercase tracking-wider mt-1">
                  {hackathon.name}
                </p>
              </>
            )}
          </div>
          {hackathon.isActive && (
            <span className="flex items-center gap-2 text-xs text-[#00FF41] uppercase tracking-widest border border-[#00FF41]/30 px-3 py-1.5">
              <span className="status-pulse h-1.5 w-1.5 bg-[#00FF41] inline-block" />
              [LiVE]
            </span>
          )}
        </div>
      </div>

      {tracks.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTrackId(null)}
            className={cn(
              "px-3 py-1 text-xs font-bold uppercase tracking-wider border transition-colors",
              selectedTrackId === null
                ? "border-white text-white bg-white/10"
                : "border-[#1F1F1F] text-[#555555] hover:border-white hover:text-white"
            )}
          >
            ALL TRACKS
          </button>
          {tracks.map((track) => (
            <button
              key={track._id as string}
              onClick={() => setSelectedTrackId((track._id as string) === selectedTrackId ? null : (track._id as string))}
              className={cn(
                "px-3 py-1 text-xs font-bold uppercase tracking-wider border transition-colors",
                selectedTrackId === (track._id as string)
                  ? "border-[#00B4FF] text-[#00B4FF] bg-[#00B4FF]/10"
                  : "border-[#1F1F1F] text-[#555555] hover:border-[#00B4FF] hover:text-[#00B4FF]"
              )}
            >
              {track.name}
            </button>
          ))}
        </div>
      )}

      {leaderboard.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-[#1F1F1F] bg-[#0A0A0A] py-16">
          <div className="mb-4 text-4xl font-bold text-[#1F1F1F]">[ ]</div>
          <h3 className="text-sm font-bold text-[#555555] uppercase tracking-wider">
            NO SCORES YET
          </h3>
          <p className="mt-1 text-xs text-[#333333] uppercase tracking-wide">
            Scores will appear here once judges start scoring
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#1F1F1F] bg-[#0A0A0A]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F1F1F] text-left bg-[#111111]">
                <th className="px-4 py-3 text-xs font-bold text-[#555555] uppercase tracking-widest">RANK</th>
                <th className="px-4 py-3 text-xs font-bold text-[#555555] uppercase tracking-widest">TEAM</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-[#555555] uppercase tracking-widest">
                  SCORE
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-[#555555] uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => {
                const displayRank = index + 1;
                return (
                  <tr
                    key={entry.teamId}
                    className={cn(getRankRowClass(displayRank))}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-sm font-bold",
                          displayRank === 1
                            ? "text-[#FF6600]"
                            : displayRank <= 3
                              ? "text-white"
                              : "text-[#555555]"
                        )}
                      >
                        {getRankLabel(displayRank)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-bold uppercase tracking-wide",
                            displayRank === 1
                              ? "text-[#FF6600]"
                              : displayRank <= 3
                                ? "text-white"
                                : "text-[#555555]"
                          )}
                        >
                          {entry.teamName}
                        </span>
                        {entry.tracks.map((track) => (
                          <span
                            key={track._id as string}
                            className="tui-badge border-[#00B4FF] text-[#00B4FF]"
                          >
                            {track.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          entry.overallScore > 0
                            ? displayRank === 1 ? "text-[#FF6600]" : "text-[#00FF41]"
                            : "text-[#333333]"
                        )}
                      >
                        {entry.overallScore > 0
                          ? `${entry.overallScore.toFixed(1)}/${maxPossibleScore}`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.latestSubmission ? (
                        <Link
                          href={`/hackathon/${hackathonId}/submission/${entry.latestSubmission._id}`}
                          className="inline-flex items-center gap-1 border border-[#1F1F1F] px-3 py-1 text-xs text-[#555555] uppercase tracking-wider transition-colors hover:border-white hover:text-white"
                        >
                          VIEW →
                        </Link>
                      ) : (
                        <span className="text-xs text-[#333333]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
