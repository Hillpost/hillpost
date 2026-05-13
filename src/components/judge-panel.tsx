"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { cn, safeHref } from "@/lib/utils";
import { format } from "date-fns";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  History,
  X,
  Search,
  Tag,
} from "lucide-react";
import { PanelSkeleton } from "@/components/skeleton";

interface JudgePanelProps {
  hackathonId: Id<"hackathons">;
  hackathon: {
    organizerId: string;
  };
}

function getSubmissionTime(submittedAt: number | string | Date | null | undefined) {
  if (submittedAt == null) return Number.POSITIVE_INFINITY;
  const time = new Date(submittedAt).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

export function JudgePanel({ hackathonId, hackathon }: JudgePanelProps) {
  const { user } = useUser();
  const { isLoading } = useConvexAuth();
  const submissions = useQuery(api.submissions.list, { hackathonId });
  const categories = useQuery(api.categories.list, { hackathonId });
  const teams = useQuery(api.teams.list, { hackathonId });
  const tracks = useQuery(api.tracks.list, { hackathonId });
  const membership = useQuery(api.members.getMyMembership, { hackathonId });
  const [expandedId, setExpandedId] = useState<Id<"submissions"> | null>(null);
  const [changelogId, setChangelogId] = useState<Id<"submissions"> | null>(null);
  const [view, setView] = useState<"pending" | "judged">("pending");
  const [search, setSearch] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const teamMap = new Map(teams?.map((t) => [t._id, t.name]) ?? []);

  const trackTeamIds = useMemo(() => {
    if (!selectedTrackId || !tracks) return null;
    const track = tracks.find((t) => (t._id as string) === selectedTrackId);
    return track ? new Set(track.teamIds.map((id) => id as string)) : new Set<string>();
  }, [selectedTrackId, tracks]);

  const displayedSubmissions = useMemo(() => {
    if (!submissions) return [];
    const localTeamMap = new Map(teams?.map((t) => [t._id, t.name]) ?? []);
    return submissions
      .filter((sub) => {
        if (!user?.id) return false;
        const hasJudged = sub.judgedBy?.includes(user.id) ?? false;
        if (view === "pending" ? hasJudged : !hasJudged) return false;
        if (search.trim()) {
          const teamName = localTeamMap.get(sub.teamId) ?? "";
          if (!teamName.toLowerCase().includes(search.trim().toLowerCase()) &&
              !sub.name.toLowerCase().includes(search.trim().toLowerCase())) {
            return false;
          }
        }
        if (trackTeamIds !== null && !trackTeamIds.has(sub.teamId as string)) return false;
        return true;
      })
      .map((sub) => ({ sub, submittedAt: getSubmissionTime(sub.submittedAt) }))
      .sort((a, b) => a.submittedAt - b.submittedAt)
      .map(({ sub }) => sub);
  }, [submissions, teams, user?.id, view, search, trackTeamIds]);

  if (membership === undefined || submissions === undefined || categories === undefined || teams === undefined || tracks === undefined || isLoading || user === undefined) {
    return <PanelSkeleton />;
  }

  const isCreator = user?.id === hackathon.organizerId;

  if (!isCreator && (membership === null || (membership.role !== "judge" && membership.role !== "organizer"))) {
    throw new Error("Unauthorized: Only judges and organizers can access this panel");
  }

  if (membership?.role === "judge" && membership?.status === "pending") {
    return (
      <div className="border border-[#FF6600]/30 bg-[#FF660008] p-8 text-center">
        <h3 className="mb-2 text-sm font-bold text-[#FF6600] uppercase tracking-widest">
          [PENDING APPROVAL]
        </h3>
        <p className="text-xs text-[#555555]">
          Your judge application is pending approval by the organizer.
        </p>
      </div>
    );
  }

  if (membership?.role === "judge" && membership?.status === "rejected") {
    return (
      <div className="border border-red-500/30 bg-red-500/5 p-8 text-center">
        <h3 className="mb-2 text-sm font-bold text-red-400 uppercase tracking-widest">
          [APPLICATION REJECTED]
        </h3>
        <p className="text-xs text-[#555555]">
          Your application to judge this hackathon was not approved.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#555555] uppercase tracking-widest">── JUDGING QUEUE</span>
            {displayedSubmissions && (
              <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">
                {displayedSubmissions.length} {view === "pending" ? "PENDING" : "JUDGED"}
              </span>
            )}
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2 border border-[#1F1F1F] bg-[#111111] px-3 py-2">
          <Search className="h-3.5 w-3.5 text-[#555555] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams or projects..."
            className="flex-1 bg-transparent text-xs text-white placeholder:text-[#333333] outline-none uppercase tracking-wider"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#555555] hover:text-white transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {tracks.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedTrackId(null)}
              className={cn(
                "px-2.5 py-1 text-xs font-bold uppercase tracking-wider border transition-colors",
                selectedTrackId === null
                  ? "border-white text-white bg-white/10"
                  : "border-[#1F1F1F] text-[#555555] hover:border-white hover:text-white"
              )}
            >
              ALL
            </button>
            {tracks.map((track) => (
              <button
                key={track._id as string}
                onClick={() => setSelectedTrackId((track._id as string) === selectedTrackId ? null : (track._id as string))}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold uppercase tracking-wider border transition-colors",
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

        <div className="mb-4 flex gap-0 border border-[#1F1F1F]">
          <button
            onClick={() => { setView("pending"); setExpandedId(null); }}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-r border-[#1F1F1F]",
              view === "pending" ? "bg-white text-black" : "bg-black text-[#555555] hover:text-white"
            )}
          >
            PENDING
          </button>
          <button
            onClick={() => { setView("judged"); setExpandedId(null); }}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
              view === "judged" ? "bg-white text-black" : "bg-black text-[#555555] hover:text-white"
            )}
          >
            JUDGED
          </button>
        </div>

        {displayedSubmissions.length === 0 ? (
          <p className="text-xs text-[#555555] uppercase tracking-wider">
            {view === "pending"
              ? "NO PENDING SUBMISSIONS. GREAT JOB!"
              : "NO JUDGED SUBMISSIONS YET."}
          </p>
        ) : (
          <div className="space-y-2">
            {displayedSubmissions.map((sub) => {
              const projectHref = safeHref(sub.projectUrl);
              const demoHref = safeHref(sub.demoUrl);
              const deployedHref = safeHref(sub.deployedUrl);
              const subTracks = tracks.filter((t) => t.teamIds.includes(sub.teamId));
              return (
              <div key={sub._id} className="border border-[#1F1F1F] bg-[#111111]">
                <button
                  onClick={() => setExpandedId(expandedId === sub._id ? null : sub._id)}
                  className="flex w-full items-start sm:items-center justify-between p-4 text-left hover:bg-[#1a1a1a] transition-colors gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white uppercase tracking-wide break-words">{sub.name}</p>
                      <span className="tui-badge border-[#555555] text-[#555555] whitespace-nowrap">
                        {teamMap.get(sub.teamId) ?? "UNKNOWN TEAM"}
                      </span>
                      {sub.submissionCount > 1 && (
                        <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">
                          v{sub.submissionCount}
                        </span>
                      )}
                      {subTracks.map((st) => (
                        <span key={st._id} className="tui-badge border-[#FF6600] text-[#FF6600] flex items-center gap-1">
                          <Tag className="h-2.5 w-2.5" />
                          {st.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-[#555555]">{sub.description}</p>
                    {sub.submissionCount > 1 && sub.changelog && sub.changelog.length > 0 && (() => {
                      const latestEntry = sub.changelog[sub.changelog.length - 1];
                      return (
                        <div className="mt-2 border border-[#00B4FF]/20 bg-[#00B4FF08] px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-bold text-[#00B4FF] uppercase tracking-widest">WHAT&apos;S NEW:</p>
                            {sub.changelog.length > 1 && (
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label="View full changelog"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChangelogId(sub._id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setChangelogId(sub._id);
                                  }
                                }}
                                className="flex items-center gap-1 text-xs text-[#00B4FF]/70 hover:text-[#00B4FF] transition-colors uppercase tracking-wider cursor-pointer"
                              >
                                <History className="h-3 w-3" />
                                VIEW ALL ({sub.changelog.length})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#AAAAAA] whitespace-pre-wrap">
                            v{latestEntry.submissionCount} — {latestEntry.whatsNew || "No notes"}
                          </p>
                        </div>
                      );
                    })()}
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#333333]">
                      <span>{format(new Date(sub.submittedAt), "MMM d, yyyy h:mm a")}</span>
                      {projectHref && (
                        <a
                          href={projectHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[#00FF41] hover:text-white transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          PROJECT
                        </a>
                      )}
                      {deployedHref && (
                        <a
                          href={deployedHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[#FF6600] hover:text-white transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Try
                        </a>
                      )}
                      {demoHref && (
                        <a
                          href={demoHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Video
                        </a>
                      )}
                    </div>
                  </div>
                  {expandedId === sub._id ? (
                    <ChevronUp className="h-4 w-4 text-[#555555] shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#555555] shrink-0" />
                  )}
                </button>

                {expandedId === sub._id && (
                  <div className="border-t border-[#1F1F1F] p-4">
                    <ScoringForm submissionId={sub._id} categories={categories} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Changelog Modal */}
      {changelogId && (() => {
        const sub = submissions?.find((s) => s._id === changelogId);
        if (!sub?.changelog || sub.changelog.length === 0) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            role="dialog"
            aria-modal="true"
            aria-labelledby="changelog-modal-title"
            onClick={() => setChangelogId(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setChangelogId(null);
            }}
          >
            <div
              className="relative w-full max-w-lg mx-4 max-h-[80vh] border border-[#00B4FF]/30 bg-[#0A0A0A] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F1F]">
                <div className="flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-[#00B4FF]" />
                  <span id="changelog-modal-title" className="text-xs font-bold text-[#00B4FF] uppercase tracking-widest">
                    CHANGELOG — {sub.name}
                  </span>
                </div>
                <button
                  onClick={() => setChangelogId(null)}
                  className="p-1.5 text-[#555555] hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {[...sub.changelog].reverse().map((entry) => (
                  <div key={`${entry.submissionCount}-${entry.submittedAt}`} className="border-t border-[#00B4FF]/10 pt-3 first:border-t-0 first:pt-0">
                    <p className="text-xs font-bold text-[#00B4FF]/80 uppercase tracking-wider mb-1">
                      v{entry.submissionCount} — {format(new Date(entry.submittedAt), "MMM d, yyyy h:mm a")}
                    </p>
                    <p className="text-sm text-[#AAAAAA] whitespace-pre-wrap">
                      {entry.whatsNew || "No notes provided"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

interface ScoringFormProps {
  submissionId: Id<"submissions">;
  categories: Array<{
    _id: Id<"categories">;
    name: string;
    description: string;
    maxScore: number;
  }>;
}

function ScoringForm({ submissionId, categories }: ScoringFormProps) {
  const myScores = useQuery(api.scores.getMyScoresForSubmission, { submissionId });
  const submitScore = useMutation(api.scores.submit);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const getExistingScore = (categoryId: Id<"categories">) => {
    return myScores?.find((s) => s.categoryId === categoryId);
  };

  const getCurrentScore = (categoryId: Id<"categories">, maxScore: number) => {
    if (scores[categoryId] !== undefined) return scores[categoryId];
    const existing = getExistingScore(categoryId);
    return existing?.score ?? Math.floor(maxScore / 2);
  };

  const getCurrentFeedback = (categoryId: Id<"categories">) => {
    if (feedbacks[categoryId] !== undefined) return feedbacks[categoryId];
    const existing = getExistingScore(categoryId);
    return existing?.feedback ?? "";
  };

  const hasAllScored = categories.length > 0 && categories.every((cat) => getExistingScore(cat._id));

  const handleSubmitAll = async () => {
    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        categories.map((cat) => {
          const score = getCurrentScore(cat._id, cat.maxScore);
          const feedback = getCurrentFeedback(cat._id);
          return submitScore({ submissionId, categoryId: cat._id, score, feedback: feedback || undefined });
        })
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === 0) {
        toast.success("All scores submitted!");
      } else if (failed.length === results.length) {
        const reason = (failed[0] as PromiseRejectedResult).reason;
        toast.error(reason instanceof Error ? reason.message : "Failed to submit scores");
      } else {
        toast.warning(`${results.length - failed.length}/${results.length} scores submitted. Some failed — please retry.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit scores");
    } finally {
      setSubmitting(false);
    }
  };

  if (!myScores) {
    return null;
  }

  return (
    <div className="space-y-4">
      {categories.length === 0 ? (
        <p className="text-xs text-[#555555] uppercase tracking-wider">NO SCORING CATEGORIES DEFINED YET.</p>
      ) : (
        categories.map((cat) => {
          const existing = getExistingScore(cat._id);
          const currentScore = getCurrentScore(cat._id, cat.maxScore);
          const currentFeedback = getCurrentFeedback(cat._id);
          const scorePercent = Math.round((currentScore / cat.maxScore) * 10);
          const filledBlocks = "█".repeat(scorePercent);
          const emptyBlocks = "░".repeat(10 - scorePercent);

          return (
            <div key={cat._id} className="border border-[#1F1F1F] bg-black p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-widest">{cat.name}</p>
                  {cat.description.trim().length > 0 && <p className="text-xs text-[#555555] whitespace-pre-wrap break-words">{cat.description}</p>}
                </div>
                {existing && (
                  <span className="tui-badge border-[#00FF41] text-[#00FF41]">[SCORED]</span>
                )}
              </div>

              <div className="space-y-3">
                {/* ASCII progress bar */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#555555] font-bold tracking-wider">
                    {filledBlocks}{emptyBlocks}
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {currentScore}/{cat.maxScore}
                  </span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="range"
                    min={0}
                    max={cat.maxScore}
                    value={currentScore}
                    onChange={(e) => setScores({ ...scores, [cat._id]: Number(e.target.value) })}
                    className="flex-1 min-w-0 accent-[#00FF41]"
                  />
                  <input
                    type="number"
                    min={0}
                    max={cat.maxScore}
                    value={currentScore}
                    onChange={(e) => setScores({ ...scores, [cat._id]: Math.min(Number(e.target.value), cat.maxScore) })}
                    className="w-16 border border-[#1F1F1F] bg-black px-2 py-1 text-center text-sm text-white focus:border-white focus:outline-none"
                  />
                </div>

                <div className="flex items-start gap-2">
                  <MessageSquare className="mt-2 h-3.5 w-3.5 flex-shrink-0 text-[#555555]" />
                  <textarea
                    value={currentFeedback}
                    onChange={(e) => setFeedbacks({ ...feedbacks, [cat._id]: e.target.value })}
                    placeholder="Feedback (optional)"
                    rows={2}
                    className="tui-input flex-1"
                  />
                </div>
              </div>
            </div>
          );
        })
      )}

      {categories.length > 0 && (
        <button
          onClick={handleSubmitAll}
          disabled={submitting}
          className={cn(
            "w-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50",
            hasAllScored
              ? "border border-[#00B4FF] text-[#00B4FF] hover:bg-[#00B4FF] hover:text-black"
              : "border border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black"
          )}
        >
          {submitting
            ? "SAVING..."
            : hasAllScored
              ? "[ UPDATE ALL SCORES ]"
              : "[ SUBMIT ALL SCORES → ]"}
        </button>
      )}
    </div>
  );
}
