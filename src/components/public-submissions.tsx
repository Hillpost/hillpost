import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { format } from "date-fns";
import { ExternalLink, Pencil, X, History } from "lucide-react";
import { toast } from "sonner";
import { cn, safeHref } from "@/lib/utils";

interface PublicSubmissionsProps {
  hackathonId: Id<"hackathons">;
  role?: string;
}

export function PublicSubmissions({ hackathonId, role }: PublicSubmissionsProps) {
  const router = useRouter();
  const submissions = useQuery(api.submissions.list, { hackathonId });
  const teams = useQuery(api.teams.list, { hackathonId });
  const tracks = useQuery(api.tracks.list, { hackathonId });
  const updateSubmissionOrganizer = useMutation(api.submissions.updateSubmissionOrganizer);
  const setTeamTrackOrganizer = useMutation(api.tracks.setTeamTrackOrganizer);

  const [editingId, setEditingId] = useState<Id<"submissions"> | null>(null);
  const [editTeamId, setEditTeamId] = useState<Id<"teams"> | null>(null);
  const [changelogId, setChangelogId] = useState<Id<"submissions"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editProjUrl, setEditProjUrl] = useState("");
  const [editDemoUrl, setEditDemoUrl] = useState("");
  const [editDeployedUrl, setEditDeployedUrl] = useState("");
  const [editTrackId, setEditTrackId] = useState<Id<"tracks"> | null>(null);

  const startEditing = (sub: { _id: Id<"submissions">; teamId: Id<"teams">; name: string; description: string; projectUrl: string; demoUrl?: string; deployedUrl?: string }) => {
    setEditingId(sub._id);
    setEditTeamId(sub.teamId);
    setEditName(sub.name);
    setEditDesc(sub.description);
    setEditProjUrl(sub.projectUrl);
    setEditDemoUrl(sub.demoUrl || "");
    setEditDeployedUrl(sub.deployedUrl || "");
    const currentTrack = tracks?.find((t) => t.teamIds.includes(sub.teamId));
    setEditTrackId(currentTrack?._id ?? null);
  };

  const handleSave = async (submissionId: Id<"submissions">) => {
    if (!editName.trim() || !editDesc.trim() || !editProjUrl.trim()) return;
    try {
      await updateSubmissionOrganizer({
        submissionId,
        name: editName,
        description: editDesc,
        projectUrl: editProjUrl,
        demoUrl: editDemoUrl || undefined,
        deployedUrl: editDeployedUrl || undefined,
      });
      if (editTeamId) {
        await setTeamTrackOrganizer({ hackathonId, teamId: editTeamId, trackId: editTrackId });
      }
      toast.success("Submission updated");
      setEditingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update submission");
    }
  };

  const teamMap = new Map(teams?.map((t) => [t._id, t.name]) ?? []);

  return (
    <div className="space-y-4">
      {!submissions || !teams ? (
        <p className="text-xs text-[#555555] uppercase tracking-wider cursor-blink">▓▓▓░░░ LOADING...</p>
      ) : submissions.length === 0 ? (
        <p className="text-xs text-[#555555] uppercase tracking-wider">NO PROJECTS SUBMITTED YET.</p>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => {
            const projectHref = safeHref(sub.projectUrl);
            const demoHref = safeHref(sub.demoUrl);
            const deployedHref = safeHref(sub.deployedUrl);
            return (
              <div
                key={sub._id}
                onClick={() => router.push(`/hackathon/${hackathonId}/submission/${sub._id}`)}
                onKeyDown={(e) => {
                  if (e.currentTarget !== e.target) return;
                  if (e.repeat) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/hackathon/${hackathonId}/submission/${sub._id}`);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`View project: ${sub.name}`}
                className="border border-[#1F1F1F] bg-[#0A0A0A] p-4 transition-colors hover:border-[#00FF41] cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white uppercase tracking-wide">{sub.name}</p>
                      <span className="tui-badge border-[#555555] text-[#555555]">
                        {teamMap.get(sub.teamId) ?? "UNKNOWN TEAM"}
                      </span>
                      {sub.submissionCount > 1 && (
                        <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">
                          v{sub.submissionCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#555555]">{sub.description}</p>
                    {sub.submissionCount > 1 && sub.changelog && sub.changelog.length > 0 && (
                      <div className="mt-2 border border-[#00B4FF]/20 bg-[#00B4FF08] px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold text-[#00B4FF] uppercase tracking-widest">WHAT&apos;S NEW:</p>
                          {sub.changelog.length > 1 && (
                            <button
                              aria-label="View full changelog"
                              onClick={(e) => {
                                e.stopPropagation();
                                setChangelogId(sub._id);
                              }}
                              className="flex items-center gap-1 text-xs text-[#00B4FF]/70 hover:text-[#00B4FF] transition-colors uppercase tracking-wider cursor-pointer"
                            >
                              <History className="h-3 w-3" />
                              VIEW ALL ({sub.changelog.length})
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-[#AAAAAA] whitespace-pre-wrap">
                          v{sub.changelog[sub.changelog.length - 1].submissionCount} — {sub.changelog[sub.changelog.length - 1].whatsNew || "No notes"}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-[#333333] mt-1.5 uppercase tracking-wider">
                      Updated {format(new Date(sub.submittedAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {role === "organizer" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(sub); }}
                        className="border border-[#1F1F1F] p-1.5 text-[#555555] hover:border-white hover:text-white transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {projectHref && (
                      <a
                        href={projectHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
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
                        onClick={(e) => e.stopPropagation()}
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
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 border border-[#AA44FF] px-3 py-1.5 text-xs font-bold text-[#AA44FF] uppercase tracking-wider hover:bg-[#AA44FF] hover:text-black transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        LIVE DEMO
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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

      {/* Edit Submission Sheet */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex justify-end transition-all duration-300",
          editingId ? "visible opacity-100" : "invisible opacity-0"
        )}
      >
        <div
          className="absolute inset-0 bg-black/70 transition-opacity duration-300"
          onClick={() => setEditingId(null)}
        />
        <div
          className={cn(
            "relative z-10 w-full max-w-md border-l border-[#1F1F1F] bg-[#0A0A0A] h-full flex flex-col transform transition-transform duration-300 ease-in-out",
            editingId ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F1F]">
            <span className="text-xs font-bold text-white uppercase tracking-widest">── EDIT SUBMISSION</span>
            <button
              onClick={() => setEditingId(null)}
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
                <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">TRACK (OPTIONAL):</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tracks.map((track) => {
                    const isSelected = editTrackId === track._id;
                    return (
                      <button
                        key={track._id}
                        type="button"
                        onClick={() => setEditTrackId(isSelected ? null : track._id)}
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
              onClick={() => setEditingId(null)}
              className="px-4 py-1.5 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={() => editingId && handleSave(editingId)}
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
