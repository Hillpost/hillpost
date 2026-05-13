"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ExternalLink, MessageSquare } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SectionSkeleton } from "@/components/skeleton";

interface CompetitorPanelProps {
  hackathonId: Id<"hackathons">;
  hackathon: {
    submissionFrequencyMinutes: number;
    feedbackVisible?: boolean;
    scoresVisible?: boolean;
  };
}

export function CompetitorPanel({ hackathonId, hackathon }: CompetitorPanelProps) {
  return (
    <div className="space-y-4">
      <TeamSection hackathonId={hackathonId} />
      <SubmitSection hackathonId={hackathonId} hackathon={hackathon} />
    </div>
  );
}

function TeamSection({ hackathonId }: { hackathonId: Id<"hackathons"> }) {
  const myTeam = useQuery(api.teams.getMyTeam, { hackathonId });
  const teams = useQuery(api.teams.list, { hackathonId });
  const tracks = useQuery(api.tracks.list, { hackathonId });
  const createTeam = useMutation(api.teams.create);
  const joinTeam = useMutation(api.teams.joinTeam);
  const leaveTeam = useMutation(api.teams.leaveTeam);
  const setMyTeamTracks = useMutation(api.tracks.setMyTeamTracks);

  const [teamName, setTeamName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const myTrackIds = myTeam && tracks
    ? tracks.filter((t) => t.teamIds.includes(myTeam._id)).map((t) => t._id)
    : [];

  const handleToggleTrack = async (trackId: Id<"tracks">) => {
    const isSelected = myTrackIds.includes(trackId);
    const newTrackIds = isSelected
      ? myTrackIds.filter((id) => id !== trackId)
      : [...myTrackIds, trackId];
    try {
      await setMyTeamTracks({ hackathonId, trackIds: newTrackIds });
      toast.success(isSelected ? "Track removed" : "Track added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update tracks");
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    try {
      await createTeam({ hackathonId, name: teamName.trim() });
      toast.success("Team created!");
      setTeamName("");
      setShowCreateForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create team");
    }
  };

  const handleJoinTeam = async (teamId: Id<"teams">) => {
    try {
      await joinTeam({ teamId });
      toast.success("Joined team!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join team");
    }
  };

  const handleLeaveTeam = async () => {
    try {
      await leaveTeam({ hackathonId });
      toast.success("Left team");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave team");
    }
  };

  if (myTeam === undefined || teams === undefined) {
    return <SectionSkeleton title="TEAM" />;
  }

  if (myTeam) {
    return (
      <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#555555] uppercase tracking-widest">── MY TEAM</span>
            <h3 className="mt-1 text-sm font-bold text-[#00FF41] uppercase tracking-wide">
              {myTeam.name}
            </h3>
          </div>
          <button
            onClick={handleLeaveTeam}
            className="flex items-center gap-1.5 border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 uppercase tracking-wider hover:border-red-500 hover:bg-red-500 hover:text-black transition-colors"
          >
            [ LEAVE ]
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-[#555555] uppercase tracking-widest mb-2">MEMBERS:</p>
          {myTeam.members.map((m) => (
            <p key={m._id} className="text-xs text-[#555555]">
              ├── {m.userName}
            </p>
          ))}
        </div>
        {tracks && tracks.length > 0 && (
          <div className="mt-4 border-t border-[#1F1F1F] pt-4">
            <p className="mb-2 text-xs font-bold text-[#555555] uppercase tracking-widest">TRACKS:</p>
            <div className="flex flex-wrap gap-2">
              {tracks.map((track) => {
                const isSelected = myTrackIds.includes(track._id);
                return (
                  <button
                    key={track._id}
                    onClick={() => handleToggleTrack(track._id)}
                    title={track.description}
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
    );
  }

  return (
    <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-[#555555] uppercase tracking-widest">── TEAM</span>
        <div className="h-px flex-1 bg-[#1F1F1F]" />
      </div>

      <div className="mb-4">
        {showCreateForm ? (
          <form onSubmit={handleCreateTeam} className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team name"
                className="tui-input pl-7"
                required
              />
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">
              CREATE
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors">
              CANCEL
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 border border-[#00FF41] px-4 py-2 text-xs font-bold text-[#00FF41] uppercase tracking-wider hover:bg-[#00FF41] hover:text-black transition-colors"
          >
            [ + CREATE NEW TEAM ]
          </button>
        )}
      </div>

      {teams && teams.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-[#555555] uppercase tracking-widest">OR JOIN AN EXISTING TEAM:</p>
          <div className="space-y-2">
            {teams.map((team) => (
              <div key={team._id} className="flex items-center justify-between border border-[#1F1F1F] bg-[#111111] px-3 py-2">
                <div>
                  <p className="text-sm font-bold text-white uppercase tracking-wide">{team.name}</p>
                  <p className="text-xs text-[#555555]">{team.members.length} MEMBER(S)</p>
                </div>
                <button
                  onClick={() => handleJoinTeam(team._id)}
                  className="border border-[#1F1F1F] px-3 py-1 text-xs text-[#555555] uppercase tracking-wider hover:border-white hover:text-white transition-colors"
                >
                  [ JOIN ]
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmitSection({ hackathonId, hackathon }: CompetitorPanelProps) {
  const myTeam = useQuery(api.teams.getMyTeam, { hackathonId });
  const latestSubmission = useQuery(
    api.submissions.getLatestForTeam,
    myTeam ? { hackathonId, teamId: myTeam._id } : "skip"
  );
  const createSubmission = useMutation(api.submissions.create);
  const updateDetails = useMutation(api.submissions.updateDetails);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [deployedUrl, setDeployedUrl] = useState("");
  const [whatsNew, setWhatsNew] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (latestSubmission) {
      setName(latestSubmission.name);
      setDescription(latestSubmission.description);
      setProjectUrl(latestSubmission.projectUrl);
      setDemoUrl(latestSubmission.demoUrl || "");
      setDeployedUrl(latestSubmission.deployedUrl || "");
    }
  }, [latestSubmission]);

  useEffect(() => {
    if (!latestSubmission || !hackathon.submissionFrequencyMinutes) return;
    const cooldownMs = hackathon.submissionFrequencyMinutes * 60 * 1000;
    const updateCooldown = () => {
      const elapsed = Date.now() - latestSubmission.submittedAt;
      const remaining = Math.max(0, cooldownMs - elapsed);
      setCooldownRemaining(remaining);
    };
    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [latestSubmission, hackathon.submissionFrequencyMinutes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTeam) return;
    setIsSubmitting(true);
    try {
      await createSubmission({
        hackathonId,
        teamId: myTeam._id,
        name,
        description,
        projectUrl,
        demoUrl: demoUrl || undefined,
        deployedUrl: deployedUrl || undefined,
        whatsNew: latestSubmission ? (whatsNew.trim() || undefined) : undefined,
      });
      toast.success(latestSubmission ? "Project resubmitted!" : "Submission created!");
      if (!latestSubmission) {
        setName("");
        setDescription("");
        setProjectUrl("");
        setDemoUrl("");
        setDeployedUrl("");
      } else {
        setWhatsNew("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTeam || !latestSubmission) return;
    setIsUpdating(true);
    try {
      await updateDetails({
        submissionId: latestSubmission._id,
        name,
        description,
        projectUrl,
        demoUrl: demoUrl || undefined,
        deployedUrl: deployedUrl || undefined,
      });
      toast.success("Project details saved!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update details");
    } finally {
      setIsUpdating(false);
    }
  };

  const isOnCooldown = cooldownRemaining > 0;
  const totalSeconds = Math.ceil(cooldownRemaining / 1000);
  const cooldownMinutes = Math.floor(totalSeconds / 60);
  const cooldownSeconds = totalSeconds % 60;
  const cooldownStr = cooldownMinutes > 0 ? `${String(cooldownMinutes).padStart(2, "0")}:${String(cooldownSeconds).padStart(2, "0")}` : `00:${String(cooldownSeconds).padStart(2, "0")}`;

  if (myTeam === undefined || (myTeam !== null && latestSubmission === undefined)) {
    return <SectionSkeleton title="PROJECT DETAILS" />;
  }

  return (
    <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-[#555555] uppercase tracking-widest">
          ── {latestSubmission ? "PROJECT DETAILS" : "SUBMIT PROJECT"}
        </span>
        <div className="h-px flex-1 bg-[#1F1F1F]" />
      </div>

      {!myTeam ? (
        <p className="text-xs text-[#555555] uppercase tracking-wider">
          JOIN A TEAM BEFORE SUBMITTING A PROJECT.
        </p>
      ) : (
        <>
          <form onSubmit={latestSubmission ? handleUpdateDetails : handleSubmit} className="space-y-4">
            {[
              { label: "PROJECT_NAME:", value: name, onChange: setName, placeholder: "my-cool-project", type: "text", required: true },
              { label: "REPO_URL:", value: projectUrl, onChange: setProjectUrl, placeholder: "https://github.com/...", type: "url", required: true },
              { label: "DEMO_URL:", value: demoUrl, onChange: setDemoUrl, placeholder: "https://youtube.com/watch?v=...", type: "url", required: false },
              { label: "DEPLOYED_URL:", value: deployedUrl, onChange: setDeployedUrl, placeholder: "https://my-project.vercel.app", type: "url", required: false },
            ].map(({ label, value, onChange, placeholder, type, required }) => (
              <div key={label}>
                <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
                  {label}
                  {!required && <span className="ml-1 text-[#333333]">(optional)</span>}
                </label>
                <input
                  type={type}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  className="tui-input"
                  required={required}
                />
              </div>
            ))}

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
                DESCRIPTION:
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does your project do?"
                rows={3}
                className="tui-input"
                required
              />
            </div>


            {latestSubmission ? (
              <div className="flex items-center gap-3 border-t border-[#1F1F1F] pt-4">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="border border-[#00FF41] px-4 py-2 text-xs font-bold text-[#00FF41] uppercase tracking-wider hover:bg-[#00FF41] hover:text-black transition-colors disabled:opacity-50"
                >
                  {isUpdating ? "SAVING..." : "[ SAVE DETAILS ]"}
                </button>
                <p className="text-xs text-[#333333]">
                  Saving details does not alert judges or trigger rate limits.
                </p>
              </div>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || isOnCooldown}
                className="border border-[#00FF41] px-4 py-2 text-xs font-bold text-[#00FF41] uppercase tracking-wider hover:bg-[#00FF41] hover:text-black transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "SUBMITTING..." : "[ SUBMIT PROJECT → ]"}
              </button>
            )}
          </form>

          {latestSubmission && hackathon.feedbackVisible !== false && hackathon.scoresVisible !== false && (
            <Link
              href={`/hackathon/${hackathonId}/submission/${latestSubmission._id}/feedback`}
              className="mt-4 flex items-center gap-2 border border-[#00B4FF]/30 bg-[#00B4FF08] px-4 py-3 text-xs font-bold text-[#00B4FF] uppercase tracking-wider hover:border-[#00B4FF] hover:bg-[#00B4FF] hover:text-black transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              VIEW JUDGE FEEDBACK →
            </Link>
          )}

          {latestSubmission && (
            <div className="mt-6 border border-[#00B4FF]/20 bg-[#00B4FF08] p-5">
              <div className="mb-3 flex flex-col gap-1">
                <h4 className="flex items-center gap-2 text-xs font-bold text-[#00B4FF] uppercase tracking-widest">
                  <ExternalLink className="h-3.5 w-3.5" />
                  JUDGING RESUBMISSION
                </h4>
                <p className="text-xs text-[#555555]">
                  Made significant changes? Request a new evaluation from judges. This resets the judging queue.
                </p>
              </div>
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
                  WHAT&apos;S NEW: <span className="ml-1 text-[#333333]">(optional)</span>
                </label>
                <textarea
                  value={whatsNew}
                  onChange={(e) => setWhatsNew(e.target.value)}
                  placeholder="Describe what changed in this resubmission..."
                  rows={3}
                  className="tui-input"
                />
              </div>
              {isOnCooldown && (
                <div className="mb-4 border border-[#FF6600]/20 bg-[#FF660008] px-3 py-2">
                  <p className="text-xs text-[#FF6600] uppercase tracking-widest font-bold">
                    NEXT SUBMISSION IN: {cooldownStr}
                  </p>
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isOnCooldown}
                className="border border-[#00B4FF] px-6 py-2 text-xs font-bold text-[#00B4FF] uppercase tracking-wider hover:bg-[#00B4FF] hover:text-black transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "RESUBMITTING..." : "[ RESUBMIT FOR JUDGING ]"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
