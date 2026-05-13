"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Pencil, X, History, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { cn, safeHref } from "@/lib/utils";
import { toast } from "sonner";
import { Tag } from "lucide-react";

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const hackathonId = params.id as Id<"hackathons">;
  const submissionId = params.submissionId as Id<"submissions">;

  const hackathon = useQuery(api.hackathons.get, { hackathonId });
  const submission = useQuery(api.submissions.get, { submissionId });
  const membership = useQuery(api.members.getMyMembership, { hackathonId });
  const categories = useQuery(api.categories.list, { hackathonId });
  const scores = useQuery(api.scores.getForSubmission, { submissionId });
  const tracks = useQuery(api.tracks.list, { hackathonId });
  const updateSubmissionOrganizer = useMutation(api.submissions.updateSubmissionOrganizer);
  const setTeamTracksOrganizer = useMutation(api.tracks.setTeamTracksOrganizer);

  const teamId = submission?.teamId;
  const team = useQuery(api.teams.get, teamId ? { teamId } : "skip");

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editProjUrl, setEditProjUrl] = useState("");
  const [editDemoUrl, setEditDemoUrl] = useState("");
  const [editDeployedUrl, setEditDeployedUrl] = useState("");
  const [editTrackIds, setEditTrackIds] = useState<Id<"tracks">[]>([]);

  const teamTracks = submission?.teamId && tracks
    ? tracks.filter((t) => t.teamIds.includes(submission.teamId))
    : [];

  const startEditing = () => {
    if (!submission) return;
    setEditName(submission.name);
    setEditDesc(submission.description);
    setEditProjUrl(submission.projectUrl);
    setEditDemoUrl(submission.demoUrl || "");
    setEditDeployedUrl(submission.deployedUrl || "");
    const currentTrackIds = tracks
      ?.filter((t) => t.teamIds.includes(submission.teamId))
      .map((t) => t._id) ?? [];
    setEditTrackIds(currentTrackIds);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editName.trim() || !editDesc.trim() || !editProjUrl.trim() || !submission) return;
    try {
      await updateSubmissionOrganizer({
        submissionId: submission._id,
        name: editName,
        description: editDesc,
        projectUrl: editProjUrl,
        demoUrl: editDemoUrl || undefined,
        deployedUrl: editDeployedUrl || undefined,
      });
      if (submission.teamId) {
        await setTeamTracksOrganizer({ hackathonId, teamId: submission.teamId, trackIds: editTrackIds });
      }
      toast.success("Submission updated");
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update submission");
    }
  };

  if (hackathon === undefined || submission === undefined || (teamId && team === undefined) || membership === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-xs text-[#555555] uppercase tracking-widest">▓▓▓░░░ LOADING...</p>
      </div>
    );
  }

  if (!hackathon || !submission) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8 text-center">
          <p className="text-sm text-[#555555] uppercase tracking-wider">SUBMISSION NOT FOUND</p>
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push(`/hackathon/${hackathonId}`);
              }
            }}
            className="mt-4 inline-flex items-center gap-1 text-xs text-[#00FF41] hover:text-white transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="h-3 w-3" />
            BACK
          </button>
        </div>
      </div>
    );
  }

  const projectHref = safeHref(submission.projectUrl);
  const demoHref = safeHref(submission.demoUrl);
  const deployedHref = safeHref(submission.deployedUrl);
  const scoresHidden = !!scores?.scoresHidden;
  const scoreEntries = scores?.entries ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back nav */}
      <button
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push(`/hackathon/${hackathonId}`);
          }
        }}
        className="mb-6 inline-flex items-center gap-1 text-xs text-[#555555] hover:text-white transition-colors uppercase tracking-wider"
      >
        <ArrowLeft className="h-3 w-3" />
        BACK
      </button>

      {/* Header */}
      <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0 w-full">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-xl font-bold text-white uppercase tracking-wide break-words">{submission.name}</h1>
              {team && (
                <span className="tui-badge border-[#555555] text-[#555555] whitespace-nowrap">{team.name}</span>
              )}
              {submission.submissionCount > 1 && (
                <span className="tui-badge border-[#00B4FF] text-[#00B4FF] whitespace-nowrap">v{submission.submissionCount}</span>
              )}
              {teamTracks.map((tt) => (
                <span key={tt._id} className="tui-badge border-[#FF6600] text-[#FF6600] whitespace-nowrap flex items-center gap-1">
                  <Tag className="h-2.5 w-2.5" />
                  {tt.name}
                </span>
              ))}
            </div>
            <p className="text-xs text-[#555555]">
              Submitted {format(new Date(submission.submittedAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
            {projectHref && (
              <a
                href={projectHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 border border-[#00FF41] px-3 py-1.5 text-xs font-bold text-[#00FF41] uppercase tracking-wider hover:bg-[#00FF41] hover:text-black transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                PROJECT
              </a>
            )}
            {demoHref && (
              <a
                href={demoHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 border border-[#00B4FF] px-3 py-1.5 text-xs font-bold text-[#00B4FF] uppercase tracking-wider hover:bg-[#00B4FF] hover:text-black transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                VIDEO
              </a>
            )}
            {deployedHref && (
              <a
                href={deployedHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 border border-[#AA44FF] px-3 py-1.5 text-xs font-bold text-[#AA44FF] uppercase tracking-wider hover:bg-[#AA44FF] hover:text-black transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                LIVE DEMO
              </a>
            )}
            {membership?.role === "organizer" && (
              <button
                onClick={startEditing}
                className="border border-[#1F1F1F] p-1.5 text-[#555555] hover:border-white hover:text-white transition-colors"
                title="Edit Submission"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-[#555555] uppercase tracking-widest">── ABOUT THE PROJECT</span>
          <div className="h-px flex-1 bg-[#1F1F1F]" />
        </div>
        <div className="text-sm text-[#AAAAAA] leading-relaxed whitespace-pre-wrap">
          {submission.description}
        </div>
      </div>

      {/* Changelog */}
      {submission.submissionCount > 1 && submission.changelog && submission.changelog.length > 0 && (
        <div className="border border-[#00B4FF]/20 bg-[#00B4FF08] p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <History className="h-3.5 w-3.5 text-[#00B4FF]" />
            <span className="text-xs text-[#00B4FF] uppercase tracking-widest">── CHANGELOG</span>
            <div className="h-px flex-1 bg-[#00B4FF]/20" />
          </div>
          <div className="space-y-3">
            {[...submission.changelog].reverse().map((entry) => (
              <div key={`${entry.submissionCount}-${entry.submittedAt}`} className="border-t border-[#00B4FF]/10 pt-3 first:border-t-0 first:pt-0">
                <p className="text-xs font-bold text-[#00B4FF]/80 uppercase tracking-wider mb-1">
                  v{entry.submissionCount} — {format(new Date(entry.submittedAt), "MMM d, yyyy h:mm a")}
                </p>
                <div className="text-sm text-[#AAAAAA] leading-relaxed whitespace-pre-wrap">
                  {entry.whatsNew || "No notes provided"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scoring Breakdown */}
      {scoresHidden && (
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-[#555555] uppercase tracking-widest">── SCORING BREAKDOWN</span>
            <div className="h-px flex-1 bg-[#1F1F1F]" />
          </div>
          <p className="text-xs text-[#333333] uppercase tracking-wide">
            The organizer has hidden score visibility for competitors.
          </p>
        </div>
      )}
      {!scoresHidden && categories && categories.length > 0 && scoreEntries.length > 0 && (() => {
        const categoryAverages = categories.map((cat) => {
          const catScoreObj = scoreEntries.find((s) => s.categoryId === cat._id);
          const avg = catScoreObj ? catScoreObj.averageScore : 0;
          return { ...cat, avg };
        });
        const overallScore = categoryAverages.reduce((sum, c) => sum + c.avg, 0);
        const maxPossible = categories.reduce((sum, c) => sum + c.maxScore, 0);

        return (
          <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-[#555555] uppercase tracking-widest">── SCORING BREAKDOWN</span>
              <div className="h-px flex-1 bg-[#1F1F1F]" />
            </div>
            <div className="space-y-3">
              {categoryAverages.map((cat) => {
                const barWidth = 10;
                const filled = Math.min(barWidth, Math.max(0, cat.maxScore > 0 ? Math.round((cat.avg / cat.maxScore) * barWidth) : 0));
                const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);

                return (
                  <div key={cat._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 border border-[#1F1F1F] bg-black px-4 py-3">
                    <span className="text-xs font-bold text-white uppercase tracking-widest shrink-0">
                      {cat.name}
                    </span>
                    <span className="font-mono text-xs">
                      <span className="text-[#00FF41]">{bar}</span>{" "}
                      <span className="text-white">{cat.avg.toFixed(1)}</span>
                      <span className="text-[#555555]">/{cat.maxScore}</span>
                    </span>
                  </div>
                );
              })}
              {/* Overall tally */}
              <div className="flex items-center justify-between gap-4 border border-[#00FF41]/30 bg-[#00FF4108] px-4 py-3">
                <span className="text-xs font-bold text-[#00FF41] uppercase tracking-widest">
                  OVERALL
                </span>
                <span className="font-mono text-sm font-bold text-[#00FF41]">
                  {overallScore.toFixed(1)}/{maxPossible}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Feedback link */}
      {membership && (
        (membership.role === "organizer" ||
          (membership.role === "competitor" &&
            hackathon?.feedbackVisible !== false &&
            hackathon?.scoresVisible !== false &&
            submission &&
            membership.teamId === submission.teamId)) && (
          <Link
            href={`/hackathon/${hackathonId}/submission/${submissionId}/feedback`}
            className="mb-4 flex items-center gap-2 border border-[#00B4FF]/30 bg-[#00B4FF08] px-5 py-4 text-xs font-bold text-[#00B4FF] uppercase tracking-wider hover:border-[#00B4FF] hover:bg-[#00B4FF] hover:text-black transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            VIEW JUDGE FEEDBACK →
          </Link>
        )
      )}

      {/* Team Members */}
      {team && team.members && team.members.length > 0 && (
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-[#555555] uppercase tracking-widest">── TEAM MEMBERS</span>
            <div className="h-px flex-1 bg-[#1F1F1F]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {team.members.map((member) => (
              <div
                key={member._id}
                className="flex items-center gap-3 border border-[#1F1F1F] bg-[#111111] px-3 py-2"
              >
                <div className="h-8 w-8 overflow-hidden bg-[#1F1F1F] flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={member.userImageUrl || `https://api.dicebear.com/9.x/initials/svg?seed=${member.userName || "User"}`}
                    alt={member.userName || "User"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white uppercase tracking-wide truncate">
                    {member.userName || "Team Member"}
                  </p>
                  <p className="text-xs text-[#555555] uppercase tracking-wider">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Submission Panel */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex justify-end transition-all duration-300",
          isEditing ? "visible opacity-100" : "invisible opacity-0"
        )}
      >
        <div
          className="absolute inset-0 bg-black/70 transition-opacity duration-300"
          onClick={() => setIsEditing(false)}
        />
        <div
          className={cn(
            "relative z-10 w-full max-w-md border-l border-[#1F1F1F] bg-[#0A0A0A] h-full flex flex-col transform transition-transform duration-300 ease-in-out",
            isEditing ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F1F]">
            <span className="text-xs font-bold text-white uppercase tracking-widest">── EDIT SUBMISSION</span>
            <button
              onClick={() => setIsEditing(false)}
              className="p-1.5 text-[#555555] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">PROJECT NAME:</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="tui-input mt-2"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">DESCRIPTION:</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={5}
                className="tui-input mt-2"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">PROJECT URL:</label>
              <input
                type="url"
                value={editProjUrl}
                onChange={(e) => setEditProjUrl(e.target.value)}
                className="tui-input mt-2"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">VIDEO URL (OPTIONAL):</label>
              <input
                type="url"
                value={editDemoUrl}
                onChange={(e) => setEditDemoUrl(e.target.value)}
                className="tui-input mt-2"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">DEPLOYMENT URL (OPTIONAL):</label>
              <input
                type="url"
                value={editDeployedUrl}
                onChange={(e) => setEditDeployedUrl(e.target.value)}
                className="tui-input mt-2"
              />
            </div>
            {tracks && tracks.length > 0 && (
              <div>
                <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">TRACKS (OPTIONAL):</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tracks.map((track) => {
                    const isSelected = editTrackIds.includes(track._id);
                    return (
                      <button
                        key={track._id}
                        type="button"
                        onClick={() => setEditTrackIds(isSelected
                          ? editTrackIds.filter((id) => id !== track._id)
                          : [...editTrackIds, track._id]
                        )}
                        className={cn(
                          "px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors",
                          isSelected
                            ? "border-[#00B4FF] bg-[#00B4FF] text-black"
                            : "border-[#1F1F1F] text-[#555555] hover:border-[#00B4FF] hover:text-[#00B4FF]"
                        )}
                      >
                        {track.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#1F1F1F] px-5 py-4 flex justify-end gap-2 shrink-0">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-1.5 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              disabled={!editName.trim() || !editDesc.trim() || !editProjUrl.trim()}
              className="px-4 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              [ SAVE CHANGES ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
