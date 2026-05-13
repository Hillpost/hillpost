"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, History, Download, EyeOff, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const barWidth = 10;
  const filled = Math.min(barWidth, Math.max(0, maxScore > 0 ? Math.round((score / maxScore) * barWidth) : 0));
  const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
  return (
    <span className="font-mono text-xs">
      <span className="text-[#00FF41]">{bar}</span>{" "}
      <span className="text-white">{score}</span>
      <span className="text-[#555555]">/{maxScore}</span>
    </span>
  );
}

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const hackathonId = params.id as Id<"hackathons">;
  const submissionId = params.submissionId as Id<"submissions">;

  const membership = useQuery(api.members.getMyMembership, { hackathonId });
  const feedback = useQuery(api.scores.getFeedbackForSubmission, {
    submissionId,
  });

  // Only fetch the submission (and its team) when feedback exists and is not hidden.
  const hasFeedbackData = feedback != null && !("feedbackHidden" in feedback);
  const submission = useQuery(
    api.submissions.get,
    hasFeedbackData ? { submissionId } : "skip"
  );

  const teamId = submission?.teamId;
  const team = useQuery(api.teams.get, teamId ? { teamId } : "skip");

  const [selectedIteration, setSelectedIteration] = useState<number | null>(
    null
  );
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportTriggerRef = useRef<HTMLButtonElement>(null);

  // Close export menu on Escape and restore focus to the trigger.
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExportMenuOpen(false);
        exportTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [exportMenuOpen]);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/hackathon/${hackathonId}`);
    }
  };

  if (membership === undefined || feedback === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-xs text-[#555555] uppercase tracking-widest">
          ▓▓▓░░░ LOADING...
        </p>
      </div>
    );
  }

  // null means the user has no access or there is no feedback yet.
  if (feedback === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8 text-center">
          <p className="text-sm text-[#555555] uppercase tracking-wider">
            FEEDBACK NOT AVAILABLE
          </p>
          <button
            onClick={goBack}
            className="mt-4 inline-flex items-center gap-1 text-xs text-[#00FF41] hover:text-white transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="h-3 w-3" />
            BACK
          </button>
        </div>
      </div>
    );
  }

  // Feedback is explicitly hidden from competitors by the organizer.
  // feedback is non-null here; feedbackHidden is on both union arms (true | undefined).
  if (feedback.feedbackHidden) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          onClick={goBack}
          className="mb-6 inline-flex items-center gap-1 text-xs text-[#555555] hover:text-white transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="h-3 w-3" />
          BACK
        </button>
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8 text-center">
          <EyeOff className="h-8 w-8 text-[#555555] mx-auto mb-3" />
          <p className="text-sm text-[#555555] uppercase tracking-wider">
            FEEDBACK HIDDEN
          </p>
          <p className="mt-2 text-xs text-[#333333]">
            The organizer has hidden feedback from you.
          </p>
          <button
            onClick={goBack}
            className="mt-4 inline-flex items-center gap-1 text-xs text-[#00FF41] hover:text-white transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="h-3 w-3" />
            BACK
          </button>
        </div>
      </div>
    );
  }

  // feedback is narrowed to the full data shape (not null, not feedbackHidden).
  // Wait for the submission query to finish loading.
  if (submission === undefined || !membership) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-xs text-[#555555] uppercase tracking-widest">
          ▓▓▓░░░ LOADING...
        </p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8 text-center">
          <p className="text-sm text-[#555555] uppercase tracking-wider">
            FEEDBACK NOT AVAILABLE
          </p>
          <button
            onClick={goBack}
            className="mt-4 inline-flex items-center gap-1 text-xs text-[#00FF41] hover:text-white transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="h-3 w-3" />
            BACK
          </button>
        </div>
      </div>
    );
  }

  const isOrganizer = membership.role === "organizer";
  // feedback is narrowed to the full data shape by the null and feedbackHidden guards above.
  const { iterations, categories, currentSubmissionCount } = feedback;

  // Default to the current (most recent) iteration
  const activeIteration =
    selectedIteration ?? currentSubmissionCount;
  const currentIterData = iterations.find(
    (it) => it.submissionCount === activeIteration
  );
  const judges = currentIterData?.judges ?? [];

  const hasMultipleIterations = iterations.length > 1;

  const buildMarkdownLines = (
    iters: typeof iterations,
    anonymize: boolean
  ): string[] => {
    const lines: string[] = [];
    lines.push(`# Judge Feedback: ${submission.name}`);
    if (team) lines.push(`**Team:** ${team.name}`);
    lines.push(`**Current Version:** v${currentSubmissionCount}`);
    if (anonymize) lines.push("*Judge identities anonymized.*");
    lines.push("");

    // Precompute category map for O(1) lookups instead of find() inside nested loops.
    const categoryMap = new Map(categories.map((c) => [c._id, c]));

    for (const iter of [...iters].sort((a, b) => a.submissionCount - b.submissionCount)) {
      lines.push(`## Version ${iter.submissionCount}${iter.submissionCount === currentSubmissionCount ? " (current)" : ""}`);
      lines.push("");
      iter.judges.forEach((judge, idx) => {
        lines.push(`### ${anonymize ? `Judge ${idx + 1}` : judge.label}`);
        for (const cs of judge.categoryScores) {
          const cat = categoryMap.get(cs.categoryId);
          if (!cat) continue;
          lines.push(`**${cat.name}:** ${cs.score != null ? `${cs.score}/${cat.maxScore}` : "Not scored"}`);
          if (cs.feedback) {
            lines.push("");
            lines.push(`> ${cs.feedback.replace(/\n/g, "\n> ")}`);
          }
          lines.push("");
        }
      });
    }
    return lines;
  };

  const downloadMarkdown = (lines: string[], filenameSuffix: string) => {
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = submission.name
      .replace(/[^a-zA-Z0-9_. -]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
    a.download = `feedback-${safeName}${filenameSuffix}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  };

  const exportCurrentVersion = () => {
    const iterData = iterations.filter((it) => it.submissionCount === activeIteration);
    downloadMarkdown(buildMarkdownLines(iterData, false), `-v${activeIteration}`);
    setExportMenuOpen(false);
  };

  const exportAllVersions = () => {
    downloadMarkdown(buildMarkdownLines(iterations, false), "-all-versions");
    setExportMenuOpen(false);
  };

  const exportAnonymized = () => {
    const iterData = iterations.filter((it) => it.submissionCount === activeIteration);
    downloadMarkdown(buildMarkdownLines(iterData, true), `-v${activeIteration}-anonymized`);
    setExportMenuOpen(false);
  };

  const exportAllVersionsAnonymized = () => {
    downloadMarkdown(buildMarkdownLines(iterations, true), "-all-versions-anonymized");
    setExportMenuOpen(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back nav */}
      <button
        onClick={goBack}
        className="mb-6 inline-flex items-center gap-1 text-xs text-[#555555] hover:text-white transition-colors uppercase tracking-wider"
      >
        <ArrowLeft className="h-3 w-3" />
        BACK
      </button>

      {/* Header */}
      <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-[#00B4FF]" />
            <h1 className="text-xl font-bold text-white uppercase tracking-wide">
              JUDGE FEEDBACK
            </h1>
          </div>
          <div className="relative" ref={exportMenuRef}>
              <button
                ref={exportTriggerRef}
                onClick={() => setExportMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                aria-controls="export-md-menu"
                className="flex items-center gap-1.5 border border-[#1F1F1F] px-3 py-1.5 text-xs text-[#555555] uppercase tracking-wider hover:border-[#00FF41] hover:text-[#00FF41] transition-colors"
                title="Export feedback as Markdown"
              >
                <Download className="h-3.5 w-3.5" />
                EXPORT .MD
                <ChevronDown className="h-3 w-3" />
              </button>
              {exportMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setExportMenuOpen(false)}
                  />
                  <div
                    id="export-md-menu"
                    role="menu"
                    aria-label="Export options"
                    className="absolute right-0 top-full mt-1 z-20 border border-[#1F1F1F] bg-[#0A0A0A] min-w-[200px]"
                  >
                    {isOrganizer ? (
                      <>
                        <button
                          role="menuitem"
                          onClick={exportCurrentVersion}
                          className="w-full text-left px-3 py-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white hover:bg-[#111111] transition-colors"
                        >
                          CURRENT VERSION (v{activeIteration})
                        </button>
                        <div className="border-t border-[#1F1F1F]" />
                        <button
                          role="menuitem"
                          onClick={exportAllVersions}
                          className="w-full text-left px-3 py-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white hover:bg-[#111111] transition-colors"
                        >
                          ALL VERSIONS
                        </button>
                        <div className="border-t border-[#1F1F1F]" />
                        <button
                          role="menuitem"
                          onClick={exportAnonymized}
                          className="w-full text-left px-3 py-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white hover:bg-[#111111] transition-colors"
                        >
                          ANONYMIZED (v{activeIteration})
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          role="menuitem"
                          onClick={exportAnonymized}
                          className="w-full text-left px-3 py-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white hover:bg-[#111111] transition-colors"
                        >
                          CURRENT VERSION (v{activeIteration})
                        </button>
                        <div className="border-t border-[#1F1F1F]" />
                        <button
                          role="menuitem"
                          onClick={exportAllVersionsAnonymized}
                          className="w-full text-left px-3 py-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white hover:bg-[#111111] transition-colors"
                        >
                          ALL VERSIONS
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
        </div>
        <p className="text-xs text-[#555555]">
          {submission.name}
          {team && <span> — {team.name}</span>}
          {submission.submissionCount > 1 && (
            <span className="ml-2 text-[#00B4FF]">
              v{submission.submissionCount}
            </span>
          )}
        </p>
        {!isOrganizer && (
          <p className="mt-2 text-xs text-[#333333]">
            Judge identities are kept anonymous.
          </p>
        )}
      </div>

      {/* Iteration selector */}
      {hasMultipleIterations && (
        <div className="mb-4 border border-[#1F1F1F] bg-[#0A0A0A] p-4">
          <div className="flex items-center gap-3 mb-3">
            <History className="h-3.5 w-3.5 text-[#FF6600]" />
            <span className="text-xs font-bold text-[#555555] uppercase tracking-widest">
              SCORE HISTORY
            </span>
          </div>
          <div className="flex gap-0 border border-[#1F1F1F] overflow-x-auto">
            {iterations.map((iter) => (
              <button
                key={iter.submissionCount}
                onClick={() => {
                  setSelectedIteration(iter.submissionCount);
                  setExpandedCategory(null);
                }}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-r border-[#1F1F1F] last:border-r-0 whitespace-nowrap",
                  activeIteration === iter.submissionCount
                    ? "bg-white text-black"
                    : "bg-black text-[#555555] hover:text-white"
                )}
              >
                v{iter.submissionCount}
                {iter.submissionCount === currentSubmissionCount && (
                  <span className="ml-1 text-[10px] text-[#00FF41]" aria-label="Current version">
                    ●
                  </span>
                )}
              </button>
            ))}
          </div>
          {activeIteration !== currentSubmissionCount && (
            <p className="mt-2 text-xs text-[#FF6600]">
              Viewing historical scores from v{activeIteration}
            </p>
          )}
        </div>
      )}

      {/* No scores for this iteration */}
      {judges.length === 0 && (
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8 text-center">
          <p className="text-sm text-[#555555] uppercase tracking-wider">
            NO SCORES {hasMultipleIterations ? `FOR V${activeIteration}` : "YET"}
          </p>
          <p className="mt-2 text-xs text-[#333333]">
            {hasMultipleIterations
              ? "No judges scored this iteration."
              : "This submission has not been judged yet. Check back later."}
          </p>
        </div>
      )}

      {/* Category cards */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const isExpanded = expandedCategory === cat._id;

          // Gather each judge's score + feedback for this category
          const judgeEntries = judges.map((judge) => {
            const cs = judge.categoryScores.find(
              (s) => s.categoryId === cat._id
            );
            return {
              label: judge.label,
              score: cs?.score ?? null,
              feedback: cs?.feedback ?? null,
            };
          });

          // Compute average score across judges who scored
          const scoredEntries = judgeEntries.filter((e) => e.score != null);
          const avgScore =
            scoredEntries.length > 0
              ? Math.round(
                  (scoredEntries.reduce((sum, e) => sum + e.score!, 0) /
                    scoredEntries.length) *
                    10
                ) / 10
              : null;
          const hasFeedback = judgeEntries.some((e) => e.feedback);

          return (
            <div
              key={cat._id}
              className="border border-[#1F1F1F] bg-[#0A0A0A] overflow-hidden"
            >
              {/* Category header — always visible */}
              <button
                onClick={() =>
                  setExpandedCategory(isExpanded ? null : cat._id)
                }
                className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 px-5 py-4 text-left hover:bg-[#111111] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                  <span className="text-xs font-bold text-white uppercase tracking-widest break-words">
                    {cat.name}
                  </span>
                  {avgScore != null && (
                    <ScoreBar score={avgScore} maxScore={cat.maxScore} />
                  )}
                  {hasFeedback && (
                    <MessageSquare className="h-3 w-3 text-[#00B4FF] shrink-0" />
                  )}
                </div>
                <span className="text-xs text-[#555555] uppercase tracking-wider shrink-0 sm:ml-3">
                  {isExpanded ? "[ COLLAPSE ]" : "[ EXPAND ]"}
                </span>
              </button>

              {/* Expanded content — per-judge scores + feedback */}
              {isExpanded && (
                <div className="border-t border-[#1F1F1F] px-5 py-4 space-y-3">
                  {judgeEntries.map((entry) => (
                    <div
                      key={entry.label}
                      className="border border-[#1F1F1F] bg-black p-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <span
                          className={cn(
                            "tui-badge text-[10px] whitespace-nowrap",
                            isOrganizer
                              ? "border-[#FF6600] text-[#FF6600]"
                              : "border-[#00B4FF] text-[#00B4FF]"
                          )}
                        >
                          {entry.label}
                        </span>
                        {entry.score != null ? (
                          <ScoreBar
                            score={entry.score}
                            maxScore={cat.maxScore}
                          />
                        ) : (
                          <span className="text-xs text-[#333333] uppercase">
                            NOT SCORED
                          </span>
                        )}
                      </div>
                      {entry.feedback && (
                        <div className="mt-2 border-l-2 border-[#00B4FF]/30 pl-3">
                          <p className="text-xs text-[#AAAAAA] leading-relaxed whitespace-pre-wrap">
                            {entry.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
