"use client";

import { useState, useRef } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useUser } from "@clerk/nextjs";
import {
  Copy,
  Check,
  Pencil,
  Trash2,
  Shield,
  UserX,
  Link as LinkIcon,
  GripVertical,
  Eye,
  EyeOff,
  ChevronDown,
  Globe,
  Lock,
} from "lucide-react";
import { QrCodeButton } from "@/components/qr-code-overlay";
import { PanelSkeleton, SectionSkeleton } from "@/components/skeleton";

interface OrganizerPanelProps {
  hackathonId: Id<"hackathons">;
  hackathon: {
    name: string;
    description: string;
    organizerId: string;
    competitorJoinCode: string | undefined;
    judgeJoinCode: string | undefined;
    startDate: number;
    endDate: number;
    isActive: boolean;
    submissionFrequencyMinutes: number;
    openGraphImageUrl?: string;
    isPublic?: boolean;
    feedbackVisible?: boolean;
    scoresVisible?: boolean | "all" | "judges" | "none";
  };
}

const sectionHeader = (title: string) => (
  <div className="flex items-center gap-3 mb-4">
    <span className="text-xs text-[#555555] uppercase tracking-widest">── {title}</span>
    <div className="h-px flex-1 bg-[#1F1F1F]" />
  </div>
);

export function OrganizerPanel({
  hackathonId,
  hackathon,
}: OrganizerPanelProps) {
  const { user } = useUser();
  const { isLoading } = useConvexAuth();
  const membership = useQuery(api.members.getMyMembership, { hackathonId });

  if (membership === undefined || isLoading || user === undefined) {
    return <PanelSkeleton />;
  }

  const isCreator = user?.id === hackathon.organizerId;

  if (!isCreator && (membership === null || membership.role !== "organizer")) {
    throw new Error("Unauthorized: Only organizers can manage hackathons");
  }

  return (
    <div className="space-y-4">
      <HackathonInfoSection hackathonId={hackathonId} hackathon={hackathon} />
      <PendingApprovalsSection hackathonId={hackathonId} />
      <CategoriesSection hackathonId={hackathonId} />
      <TracksSection hackathonId={hackathonId} />
      <SponsorsSection hackathonId={hackathonId} />
      <TeamsAndProjectsSection hackathonId={hackathonId} />
      <MembersSection hackathonId={hackathonId} />
    </div>
  );
}

function HackathonInfoSection({
  hackathonId,
  hackathon,
}: OrganizerPanelProps) {
  const updateHackathon = useMutation(api.hackathons.update);
  const [copiedCompetitor, setCopiedCompetitor] = useState(false);
  const [copiedJudge, setCopiedJudge] = useState(false);
  const [copiedCompetitorLink, setCopiedCompetitorLink] = useState(false);
  const [copiedJudgeLink, setCopiedJudgeLink] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(hackathon.name);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [newDesc, setNewDesc] = useState(hackathon.description);

  const [isEditingOgImage, setIsEditingOgImage] = useState(false);
  const [newOgImage, setNewOgImage] = useState(hackathon.openGraphImageUrl ?? "");

  const [isEditingDates, setIsEditingDates] = useState(false);
  const [newStartDate, setNewStartDate] = useState(
    format(new Date(hackathon.startDate), "yyyy-MM-dd")
  );
  const [newEndDate, setNewEndDate] = useState(
    format(new Date(hackathon.endDate), "yyyy-MM-dd")
  );

  const [isEditingCooldown, setIsEditingCooldown] = useState(false);
  const [newCooldown, setNewCooldown] = useState(hackathon.submissionFrequencyMinutes);

  const copyCompetitorCode = async () => {
    if (!hackathon.competitorJoinCode) return;
    try {
      await navigator.clipboard.writeText(hackathon.competitorJoinCode);
      setCopiedCompetitor(true);
      toast.success("Competitor code copied!");
      setTimeout(() => setCopiedCompetitor(false), 2000);
    } catch {
      toast.error("Failed to copy code. Please try again.");
    }
  };

  const copyJudgeCode = async () => {
    if (!hackathon.judgeJoinCode) return;
    try {
      await navigator.clipboard.writeText(hackathon.judgeJoinCode);
      setCopiedJudge(true);
      toast.success("Judge code copied!");
      setTimeout(() => setCopiedJudge(false), 2000);
    } catch {
      toast.error("Failed to copy code. Please try again.");
    }
  };

  const copyCompetitorLink = async () => {
    if (!hackathon.competitorJoinCode) return;
    try {
      const link = `${window.location.origin}/join/${hackathon.competitorJoinCode}`;
      await navigator.clipboard.writeText(link);
      setCopiedCompetitorLink(true);
      toast.success("Competitor join link copied!");
      setTimeout(() => setCopiedCompetitorLink(false), 2000);
    } catch {
      toast.error("Failed to copy link. Please try again.");
    }
  };

  const copyJudgeLink = async () => {
    if (!hackathon.judgeJoinCode) return;
    try {
      const link = `${window.location.origin}/join/${hackathon.judgeJoinCode}`;
      await navigator.clipboard.writeText(link);
      setCopiedJudgeLink(true);
      toast.success("Judge join link copied!");
      setTimeout(() => setCopiedJudgeLink(false), 2000);
    } catch {
      toast.error("Failed to copy link. Please try again.");
    }
  };

  const copyPublicLink = async () => {
    try {
      const link = `${window.location.origin}/hackathon/${hackathonId}`;
      await navigator.clipboard.writeText(link);
      setCopiedPublicLink(true);
      toast.success("Public link copied!");
      setTimeout(() => setCopiedPublicLink(false), 2000);
    } catch {
      toast.error("Failed to copy link. Please try again.");
    }
  };

  const toggleFeedbackVisible = async () => {
    const current = hackathon.feedbackVisible !== false;
    try {
      await updateHackathon({ hackathonId, feedbackVisible: !current });
      toast.success(!current ? "Feedback shown to competitors" : "Feedback hidden from competitors");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update feedback visibility");
    }
  };

  const setScoresVisibility = async (mode: "all" | "judges" | "none") => {
    try {
      await updateHackathon({ hackathonId, scoresVisible: mode });
      const labels = {
        all: "Scores visible to everyone",
        judges: "Scores visible to judges only",
        none: "Scores hidden from competitors and judges",
      };
      toast.success(labels[mode]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update score visibility");
    }
  };

  const togglePublicVisibility = async () => {
    const current = hackathon.isPublic === true;
    try {
      await updateHackathon({ hackathonId, isPublic: !current });
      toast.success(!current ? "Hackathon is now public" : "Hackathon is now invite-only");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update public visibility");
    }
  };

  const saveCooldown = async () => {
    if (newCooldown < 0) return;
    try {
      await updateHackathon({ hackathonId, submissionFrequencyMinutes: newCooldown });
      toast.success("Cooldown updated");
      setIsEditingCooldown(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update cooldown");
    }
  };

  const saveName = async () => {
    if (!newName.trim()) return;
    try {
      await updateHackathon({ hackathonId, name: newName.trim() });
      toast.success("Name updated");
      setIsEditingName(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update name");
    }
  };

  const saveDesc = async () => {
    if (!newDesc.trim()) return;
    try {
      await updateHackathon({ hackathonId, description: newDesc.trim() });
      toast.success("Description updated");
      setIsEditingDesc(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update description");
    }
  };

  const isSafeHttpUrl = (value: string): boolean => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const saveOgImage = async () => {
    const trimmed = newOgImage.trim();

    if (trimmed && !isSafeHttpUrl(trimmed)) {
      toast.error("Please enter a valid http or https URL for the OG image");
      return;
    }

    try {
      await updateHackathon({
        hackathonId,
        openGraphImageUrl: trimmed || null,
      });
      toast.success("OG Image updated");
      setIsEditingOgImage(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update OG Image");
    }
  };

  const saveDates = async () => {
    if (!newStartDate || !newEndDate) return;
    const start = new Date(newStartDate).getTime();
    const end = new Date(newEndDate).getTime();
    if (end < start) { toast.error("End date must be on or after start date"); return; }
    try {
      await updateHackathon({ hackathonId, startDate: start, endDate: end });
      toast.success("Dates updated");
      setIsEditingDates(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update dates");
    }
  };

  return (
    <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
      {sectionHeader("HACKATHON SETTINGS")}
      <div className="space-y-6">

        {/* Name */}
        <div>
          <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">NAME:</label>
          {isEditingName ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="tui-input flex-1"
              />
              <button onClick={saveName} className="px-3 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">
                SAVE
              </button>
              <button onClick={() => setIsEditingName(false)} className="px-3 py-1.5 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors">
                CANCEL
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-3">
              <span className="text-sm text-white">{hackathon.name}</span>
              <button onClick={() => setIsEditingName(true)} className="p-1.5 text-[#555555] hover:text-white transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">DESCRIPTION:</label>
          {isEditingDesc ? (
            <div className="mt-2 flex items-end gap-2">
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                className="tui-input flex-1"
              />
              <div className="flex flex-col gap-2">
                <button onClick={saveDesc} className="px-3 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">
                  SAVE
                </button>
                <button onClick={() => setIsEditingDesc(false)} className="px-3 py-1.5 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors">
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex items-start gap-3">
              <span className="text-xs text-[#555555] flex-1">{hackathon.description}</span>
              <button onClick={() => setIsEditingDesc(true)} className="p-1.5 text-[#555555] hover:text-white transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* OG Image URL */}
        <div className="border-t border-[#1F1F1F] pt-4">
          <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">SOCIAL SHARE IMAGE URL (OPTIONAL):</label>
          {isEditingOgImage ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="url"
                value={newOgImage}
                onChange={(e) => setNewOgImage(e.target.value)}
                placeholder="https://..."
                className="tui-input flex-1"
              />
              <button onClick={saveOgImage} className="px-3 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">
                SAVE
              </button>
              <button onClick={() => setIsEditingOgImage(false)} className="px-3 py-1.5 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors">
                CANCEL
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-3">
              <span className="text-xs text-[#555555] flex-1 truncate">
                {hackathon.openGraphImageUrl || "—"}
              </span>
              <button onClick={() => setIsEditingOgImage(true)} className="p-1.5 text-[#555555] hover:text-white transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <p className="mt-1 text-[10px] text-[#333333] uppercase">Used as background for leaderboard and submission social images.</p>
        </div>

        {/* Dates */}
        <div className="border-t border-[#1F1F1F] pt-4">
          <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">DATES:</label>
          {isEditingDates ? (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[#333333] uppercase">Start</label>
                <input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} className="tui-input w-auto" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#333333] uppercase">End</label>
                <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className="tui-input w-auto" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveDates} className="px-3 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">SAVE</button>
                <button onClick={() => setIsEditingDates(false)} className="px-3 py-1.5 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors">CANCEL</button>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-3">
              <span className="text-xs text-white">
                {format(new Date(hackathon.startDate), "MMM d, yyyy")} — {format(new Date(hackathon.endDate), "MMM d, yyyy")}
              </span>
              <button onClick={() => { setNewStartDate(format(new Date(hackathon.startDate), "yyyy-MM-dd")); setNewEndDate(format(new Date(hackathon.endDate), "yyyy-MM-dd")); setIsEditingDates(true); }} className="p-1.5 text-[#555555] hover:text-white transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Join Codes */}
        <div className="flex flex-col gap-4 sm:flex-row border-t border-[#1F1F1F] pt-4">
          <div className="flex-1">
            <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">COMPETITOR CODE:</label>
            <div className="mt-2 flex flex-col gap-2">
              <code className="border border-[#1F1F1F] bg-black px-4 py-2 text-base tracking-widest text-[#00FF41] font-bold break-all">
                {hackathon.competitorJoinCode ?? "—"}
              </code>
              <div className="flex items-center gap-2">
                <button onClick={copyCompetitorCode} disabled={!hackathon.competitorJoinCode} className="border border-[#1F1F1F] p-2 text-[#555555] hover:border-white hover:text-white transition-colors disabled:opacity-30" title="Copy competitor code" aria-label="Copy competitor code">
                  {copiedCompetitor ? <Check className="h-4 w-4 text-[#00FF41]" /> : <Copy className="h-4 w-4" />}
                </button>
                <button onClick={copyCompetitorLink} disabled={!hackathon.competitorJoinCode} className="border border-[#1F1F1F] p-2 text-[#555555] hover:border-white hover:text-white transition-colors disabled:opacity-30" title="Copy competitor join link" aria-label="Copy competitor join link">
                  {copiedCompetitorLink ? <Check className="h-4 w-4 text-[#00FF41]" /> : <LinkIcon className="h-4 w-4" />}
                </button>
                {hackathon.competitorJoinCode && <QrCodeButton path={`/join/${hackathon.competitorJoinCode}`} label="Competitor Join QR" />}
              </div>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">JUDGE CODE:</label>
            <div className="mt-2 flex flex-col gap-2">
              <code className="border border-[#00B4FF]/20 bg-black px-4 py-2 text-base tracking-widest text-[#00B4FF] font-bold break-all">
                {hackathon.judgeJoinCode ?? "—"}
              </code>
              <div className="flex items-center gap-2">
                <button onClick={copyJudgeCode} disabled={!hackathon.judgeJoinCode} className="border border-[#1F1F1F] p-2 text-[#555555] hover:border-white hover:text-white transition-colors disabled:opacity-30" title="Copy judge code" aria-label="Copy judge code">
                  {copiedJudge ? <Check className="h-4 w-4 text-[#00FF41]" /> : <Copy className="h-4 w-4" />}
                </button>
                <button onClick={copyJudgeLink} disabled={!hackathon.judgeJoinCode} className="border border-[#1F1F1F] p-2 text-[#555555] hover:border-white hover:text-white transition-colors disabled:opacity-30" title="Copy judge join link" aria-label="Copy judge join link">
                  {copiedJudgeLink ? <Check className="h-4 w-4 text-[#00FF41]" /> : <LinkIcon className="h-4 w-4" />}
                </button>
                {hackathon.judgeJoinCode && <QrCodeButton path={`/join/${hackathon.judgeJoinCode}`} label="Judge Join QR" />}
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-[#1F1F1F] pt-4">
          <div>
            <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">STATUS:</label>
            <p className="text-xs text-[#333333] mt-0.5">
              Event runs from {format(new Date(hackathon.startDate), "MMM d, yyyy")} to {format(new Date(hackathon.endDate), "MMM d, yyyy")}.
            </p>
            <p className="text-xs text-[#333333] mt-0.5">
              Status is automatically based on start and end dates.
            </p>
          </div>
        </div>

        {/* Cooldown */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-[#1F1F1F] pt-4">
          <div>
            <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">SUBMISSION COOLDOWN:</label>
            <p className="text-xs text-[#333333] mt-0.5">Minutes competitors must wait before resubmitting.</p>
          </div>
          {isEditingCooldown ? (
            <div className="flex items-center gap-2">
              <input type="number" min={0} value={newCooldown} onChange={(e) => setNewCooldown(Number(e.target.value))} className="tui-input w-20" />
              <button onClick={saveCooldown} className="px-3 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">SAVE</button>
              <button onClick={() => setIsEditingCooldown(false)} className="px-3 py-1.5 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors">X</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-white">{hackathon.submissionFrequencyMinutes}m</span>
              <button onClick={() => { setNewCooldown(hackathon.submissionFrequencyMinutes); setIsEditingCooldown(true); }} className="p-1.5 text-[#555555] hover:text-white transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Feedback visibility toggle */}
        {(() => {
          const feedbackPreferenceVisible = hackathon.feedbackVisible !== false;
          const rawSV = hackathon.scoresVisible;
          const scoresMode: "all" | "judges" | "none" =
            rawSV === false || rawSV === "none"
              ? "none"
              : rawSV === "judges"
                ? "judges"
                : "all";
          const scoresVisibleToAll = scoresMode === "all";
          const feedbackVisible = scoresVisibleToAll && feedbackPreferenceVisible;
          let feedbackDescription = "Feedback is hidden from competitors (judges can still submit feedback)";
          if (!scoresVisibleToAll) {
            feedbackDescription = "Feedback is hidden from competitors while score sharing is restricted.";
          } else if (feedbackVisible) {
            feedbackDescription = "Competitors can view judge feedback";
          }
          return (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-[#1F1F1F] pt-4">
              <div>
                <span className="text-xs font-bold text-[#555555] uppercase tracking-widest">COMPETITOR FEEDBACK:</span>
                <p className="text-xs text-[#333333] mt-0.5">{feedbackDescription}</p>
              </div>
              <button
                onClick={toggleFeedbackVisible}
                disabled={!scoresVisibleToAll}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  feedbackVisible
                    ? "border border-[#555555] text-[#555555] hover:border-[#FF6600] hover:text-[#FF6600]"
                    : "border border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black"
                )}
              >
                {feedbackVisible ? (
                  <><EyeOff className="h-3.5 w-3.5" /> [ HIDE ]</>
                ) : (
                  <><Eye className="h-3.5 w-3.5" /> [ SHOW ]</>
                )}
              </button>
            </div>
          );
        })()}

        {/* Score/leaderboard visibility selector */}
        {(() => {
          const raw = hackathon.scoresVisible;
          const currentMode: "all" | "judges" | "none" =
            raw === false || raw === "none"
              ? "none"
              : raw === "judges"
                ? "judges"
                : "all";
          const descriptions = {
            all: "Everyone can view score breakdowns and leaderboard rankings",
            judges: "Only judges and organizers can view scores and leaderboard",
            none: "Scores and leaderboard are hidden from judges and competitors",
          };
          const modeColors = {
            all: "border-[#00FF41] text-[#00FF41]",
            judges: "border-[#00B4FF] text-[#00B4FF]",
            none: "border-[#FF6600] text-[#FF6600]",
          };
          return (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-[#1F1F1F] pt-4">
              <div>
                <span className="text-xs font-bold text-[#555555] uppercase tracking-widest">SCORES + LEADERBOARD VISIBILITY:</span>
                <p className="text-xs text-[#333333] mt-0.5">
                  {descriptions[currentMode]}
                </p>
              </div>
              <div className="relative">
                <select
                  value={currentMode}
                  onChange={(e) => setScoresVisibility(e.target.value as "all" | "judges" | "none")}
                  className={cn(
                    "appearance-none cursor-pointer pl-3 pr-8 py-2 text-xs font-bold uppercase tracking-wider transition-colors bg-transparent border",
                    modeColors[currentMode]
                  )}
                >
                  <option value="all" className="bg-[#0A0A0A] text-[#00FF41] normal-case">All — Everyone</option>
                  <option value="judges" className="bg-[#0A0A0A] text-[#00B4FF] normal-case">Judges Only</option>
                  <option value="none" className="bg-[#0A0A0A] text-[#FF6600] normal-case">Hidden</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5" />
              </div>
            </div>
          );
        })()}

        {/* Public listing toggle */}
        <div className="border-t border-[#1F1F1F] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-[#555555] uppercase tracking-widest">PUBLIC VISIBILITY:</span>
            <span
              className={cn(
                "tui-badge",
                hackathon.isPublic
                  ? "border-[#00FF41] text-[#00FF41]"
                  : "border-[#FF6600] text-[#FF6600]"
              )}
            >
              {hackathon.isPublic ? (
                <><Globe className="inline h-3 w-3 mr-1" />PUBLIC</>
              ) : (
                <><Lock className="inline h-3 w-3 mr-1" />PRIVATE</>
              )}
            </span>
          </div>
          <p className="text-xs text-[#333333] mb-3">
            {hackathon.isPublic
              ? "Anyone can view this hackathon on the discover page and register as a competitor without a join code."
              : "Only users with a competitor or judge join code can discover and join this hackathon."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={togglePublicVisibility}
              disabled={!hackathon.isPublic}
              className={cn(
                "flex items-center justify-center gap-1.5 border py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-default",
                !hackathon.isPublic
                  ? "border-[#FF6600] bg-[#FF6600]/10 text-[#FF6600]"
                  : "border-[#1F1F1F] text-[#555555] hover:border-[#FF6600] hover:text-[#FF6600]"
              )}
            >
              <Lock className="h-3.5 w-3.5" />
              PRIVATE
            </button>
            <button
              onClick={togglePublicVisibility}
              disabled={hackathon.isPublic === true}
              className={cn(
                "flex items-center justify-center gap-1.5 border py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-default",
                hackathon.isPublic
                  ? "border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41]"
                  : "border-[#1F1F1F] text-[#555555] hover:border-[#00FF41] hover:text-[#00FF41]"
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              PUBLIC
            </button>
          </div>
          {hackathon.isPublic && (
            <div className="mt-3">
              <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">PUBLIC LINK:</label>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 truncate border border-[#1F1F1F] bg-black px-3 py-1.5 text-xs text-[#00FF41] tracking-wider">
                  {typeof window !== "undefined" ? `${window.location.origin}/hackathon/${hackathonId}` : `…/hackathon/${hackathonId}`}
                </code>
                <button
                  onClick={copyPublicLink}
                  className="shrink-0 border border-[#1F1F1F] p-2 text-[#555555] hover:border-white hover:text-white transition-colors"
                  title="Copy public link"
                  aria-label="Copy public link"
                >
                  {copiedPublicLink ? <Check className="h-4 w-4 text-[#00FF41]" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-[#333333] uppercase">Share this link so anyone can view the event and register as a competitor.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoriesSection({ hackathonId }: { hackathonId: Id<"hackathons"> }) {
  const categories = useQuery(api.categories.list, { hackathonId });
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const removeCategory = useMutation(api.categories.remove);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"categories"> | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newMaxScore, setNewMaxScore] = useState(10);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMaxScore, setEditMaxScore] = useState(10);

  if (!categories) return <SectionSkeleton title="JUDGING CATEGORIES" />;

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    try {
      await createCategory({ hackathonId, name: newName, description: newDescription, maxScore: newMaxScore });
      toast.success("Category added");
      setNewName(""); setNewDescription(""); setNewMaxScore(10); setShowAddForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add category");
    }
  };

  const handleEdit = async (categoryId: Id<"categories">) => {
    try {
      await updateCategory({ categoryId, name: editName, description: editDescription, maxScore: editMaxScore });
      toast.success("Category updated");
      setEditingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update category");
    }
  };

  const handleRemove = async (categoryId: Id<"categories">) => {
    try {
      await removeCategory({ categoryId });
      toast.success("Category removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove category");
    }
  };

  const startEditing = (cat: { _id: Id<"categories">; name: string; description: string; maxScore: number }) => {
    setEditingId(cat._id); setEditName(cat.name); setEditDescription(cat.description); setEditMaxScore(cat.maxScore);
  };

  return (
    <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#555555] uppercase tracking-widest">── JUDGING CATEGORIES</span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 border border-[#1F1F1F] px-3 py-1.5 text-xs text-[#555555] uppercase tracking-wider hover:border-[#00FF41] hover:text-[#00FF41] transition-colors"
        >
          {showAddForm ? "[ CANCEL ]" : "[ + ADD ]"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="mb-4 space-y-2 border border-[#1F1F1F] bg-[#111111] p-4">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name" className="tui-input" required />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="tui-input"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#555555] uppercase">Max Score:</label>
            <input type="number" value={newMaxScore} onChange={(e) => setNewMaxScore(Number(e.target.value))} min={1} className="tui-input w-24" />
          </div>
          <button type="submit" className="px-4 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">
            [ ADD CATEGORY ]
          </button>
        </form>
      )}

      {categories.length === 0 ? (
        <p className="text-xs text-[#555555] uppercase tracking-wider">NO CATEGORIES YET. ADD ONE TO START JUDGING.</p>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat._id} className="border border-[#1F1F1F] bg-[#111111] p-3">
              {editingId === cat._id ? (
                <div className="space-y-2">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="tui-input" />
                   <textarea
                     value={editDescription}
                     onChange={(e) => setEditDescription(e.target.value)}
                     rows={3}
                     className="tui-input"
                   />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[#555555] uppercase">Max:</label>
                    <input type="number" value={editMaxScore} onChange={(e) => setEditMaxScore(Number(e.target.value))} min={1} className="tui-input w-24" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(cat._id)} className="px-3 py-1 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">SAVE</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors">CANCEL</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white uppercase tracking-wide">{cat.name}</p>
                    {cat.description.trim().length > 0 && <p className="text-xs text-[#555555] whitespace-pre-wrap break-words">{cat.description}</p>}
                    <p className="text-xs text-[#333333] uppercase tracking-wider mt-0.5">Max: {cat.maxScore} pts</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEditing(cat)} className="p-1.5 text-[#555555] hover:text-white transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleRemove(cat._id)} className="p-1.5 text-[#555555] hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TracksSection({ hackathonId }: { hackathonId: Id<"hackathons"> }) {
  const tracks = useQuery(api.tracks.list, { hackathonId });
  const teams = useQuery(api.teams.list, { hackathonId });
  const createTrack = useMutation(api.tracks.create);
  const updateTrack = useMutation(api.tracks.update);
  const removeTrack = useMutation(api.tracks.remove);
  const assignTeam = useMutation(api.tracks.assignTeam);
  const unassignTeam = useMutation(api.tracks.unassignTeam);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"tracks"> | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [expandedTrackId, setExpandedTrackId] = useState<Id<"tracks"> | null>(null);

  const teamMap = new Map((teams ?? []).map((t) => [t._id as string, t.name]));

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createTrack({ hackathonId, name: newName.trim(), description: newDescription.trim() || undefined });
      toast.success("Track added");
      setNewName(""); setNewDescription(""); setShowAddForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add track");
    }
  };

  const handleEdit = async (trackId: Id<"tracks">) => {
    try {
      await updateTrack({ trackId, name: editName.trim(), description: editDescription.trim() || undefined });
      toast.success("Track updated");
      setEditingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update track");
    }
  };

  const handleRemove = async (trackId: Id<"tracks">) => {
    try {
      await removeTrack({ trackId });
      toast.success("Track removed");
      if (expandedTrackId === trackId) setExpandedTrackId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove track");
    }
  };

  const handleToggleTeam = async (track: { _id: Id<"tracks">; teamIds: Id<"teams">[] }, teamId: Id<"teams">) => {
    try {
      if ((track.teamIds as string[]).includes(teamId as string)) {
        await unassignTeam({ trackId: track._id, teamId });
      } else {
        await assignTeam({ trackId: track._id, teamId, hackathonId });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update team assignment");
    }
  };

  return (
    <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-[#555555] uppercase tracking-widest">── TRACKS</span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 border border-[#1F1F1F] px-3 py-1.5 text-xs text-[#555555] uppercase tracking-wider hover:border-[#00FF41] hover:text-[#00FF41] transition-colors"
        >
          {showAddForm ? "[ CANCEL ]" : "[ + ADD ]"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="mb-4 space-y-2 border border-[#1F1F1F] bg-[#111111] p-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Track name (e.g. AI Project)"
            className="tui-input"
            required
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="tui-input"
          />
          <button type="submit" className="px-4 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">
            [ ADD TRACK ]
          </button>
        </form>
      )}

      {!tracks ? (
        <p className="text-xs text-[#555555] uppercase tracking-widest">▓▓▓░░░ LOADING...</p>
      ) : tracks.length === 0 ? (
        <p className="text-xs text-[#555555] uppercase tracking-wider">NO TRACKS YET. ADD ONE TO CATEGORIZE TEAMS.</p>
      ) : (
        <div className="space-y-2">
          {tracks.map((track) => (
            <div key={track._id as string} className="border border-[#1F1F1F] bg-[#111111]">
              {editingId === track._id ? (
                <div className="space-y-2 p-3">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="tui-input" />
                  <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description (optional)" className="tui-input" />
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(track._id)} className="px-3 py-1 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">SAVE</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors">CANCEL</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between p-3">
                    <button
                      onClick={() => setExpandedTrackId(expandedTrackId === track._id ? null : track._id)}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-bold text-white uppercase tracking-wide">{track.name}</p>
                      {track.description && <p className="text-xs text-[#555555]">{track.description}</p>}
                      <p className="text-xs text-[#333333] uppercase tracking-wider mt-0.5">
                        {track.teamIds.length} {track.teamIds.length === 1 ? "TEAM" : "TEAMS"} ASSIGNED
                      </p>
                    </button>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingId(track._id); setEditName(track.name); setEditDescription(track.description ?? ""); }}
                        className="p-1.5 text-[#555555] hover:text-white transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleRemove(track._id)} className="p-1.5 text-[#555555] hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {expandedTrackId === track._id && (
                    <div className="border-t border-[#1F1F1F] p-3">
                      <p className="text-xs text-[#555555] uppercase tracking-widest mb-2">ASSIGN TEAMS</p>
                      {!teams ? (
                        <p className="text-xs text-[#333333] uppercase">LOADING TEAMS...</p>
                      ) : teams.length === 0 ? (
                        <p className="text-xs text-[#333333] uppercase">NO TEAMS IN THIS HACKATHON YET.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {teams.map((team) => {
                            const assigned = (track.teamIds as string[]).includes(team._id as string);
                            return (
                              <button
                                key={team._id as string}
                                onClick={() => handleToggleTeam(track, team._id)}
                                className={cn(
                                  "px-2.5 py-1 text-xs font-bold uppercase tracking-wider border transition-colors",
                                  assigned
                                    ? "border-[#00FF41] text-[#00FF41] bg-[#00FF41]/10"
                                    : "border-[#1F1F1F] text-[#555555] hover:border-white hover:text-white"
                                )}
                              >
                                {assigned ? "✓ " : ""}{teamMap.get(team._id as string) ?? team.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingApprovalsSection({ hackathonId }: { hackathonId: Id<"hackathons"> }) {
  const members = useQuery(api.members.listMembers, { hackathonId });
  const updateStatus = useMutation(api.members.updateStatus);

  const handleStatusChange = async (memberId: Id<"hackathonMembers">, newStatus: "approved" | "rejected") => {
    try {
      await updateStatus({ memberId, status: newStatus });
      toast.success(`Judge ${newStatus}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  if (members === undefined) return <SectionSkeleton title="PENDING APPROVALS" />;
  if (members === null) return null;

  const pendingMembers = members.filter((m) => m.status === "pending");
  if (pendingMembers.length === 0) return null;

  return (
    <div className="border border-[#FF6600]/30 bg-[#FF660008] p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-[#FF6600] uppercase tracking-widest">⚠ PENDING APPROVALS</span>
        <span className="tui-badge border-[#FF6600] text-[#FF6600]">{pendingMembers.length}</span>
      </div>
      <div className="space-y-2">
        {pendingMembers.map((member) => (
          <div key={member._id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border border-[#FF6600]/20 bg-black px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-white">{member.userName}</span>
              <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{member.role.toUpperCase()}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange(member._id, "approved")}
                className="px-3 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors"
              >
                [✓ APPROVE]
              </button>
              <button
                onClick={() => handleStatusChange(member._id, "rejected")}
                className="px-3 py-1.5 text-xs font-bold text-[#FF6600] border border-[#FF6600]/30 uppercase tracking-wider hover:border-[#FF6600] transition-colors"
              >
                [✗ REJECT]
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MembersSection({ hackathonId }: { hackathonId: Id<"hackathons"> }) {
  const members = useQuery(api.members.listMembers, { hackathonId });
  const updateRole = useMutation(api.members.updateRole);
  const updateDisplayName = useMutation(api.members.updateDisplayName);
  const removeMember = useMutation(api.members.removeMember);

  const [changingRole, setChangingRole] = useState<Id<"hackathonMembers"> | null>(null);
  const [editingName, setEditingName] = useState<Id<"hackathonMembers"> | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  if (members === undefined) return <SectionSkeleton title="MEMBERS" />;
  if (members === null) return null;

  const handleRoleChange = async (memberId: Id<"hackathonMembers">, newRole: "organizer" | "judge" | "competitor") => {
    try {
      await updateRole({ memberId, role: newRole });
      toast.success("Role updated");
      setChangingRole(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    }
  };

  const startNameEdit = (memberId: Id<"hackathonMembers">, currentName: string) => {
    setChangingRole(null);
    setEditingName(memberId);
    setNameDraft(currentName);
  };

  const cancelNameEdit = () => {
    setEditingName(null);
    setNameDraft("");
  };

  const handleNameUpdate = async (memberId: Id<"hackathonMembers">) => {
    const userName = nameDraft.trim();
    if (!userName) {
      toast.error("Display name cannot be empty");
      return;
    }

    try {
      await updateDisplayName({ memberId, userName });
      toast.success("Name updated");
      cancelNameEdit();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update name");
    }
  };

  const handleRemove = async (memberId: Id<"hackathonMembers">) => {
    try {
      await removeMember({ memberId });
      toast.success("Member removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member");
    }
  };

  const roleBadgeClass = (role: string) => {
    switch (role) {
      case "organizer": return "border-[#FF6600] text-[#FF6600]";
      case "judge": return "border-[#00B4FF] text-[#00B4FF]";
      case "competitor": return "border-[#00FF41] text-[#00FF41]";
      default: return "border-[#555555] text-[#555555]";
    }
  };

  return (
    <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
      {sectionHeader("MEMBERS")}
      {members.length === 0 ? (
        <p className="text-xs text-[#555555] uppercase tracking-wider">NO MEMBERS YET.</p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            if (member.status === "pending") return null;
            return (
              <div key={member._id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border border-[#1F1F1F] bg-[#111111] px-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  {editingName === member._id ? (
                    <input
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void handleNameUpdate(member._id);
                        }
                        if (event.key === "Escape") {
                          cancelNameEdit();
                        }
                      }}
                      maxLength={80}
                      className="min-w-0 flex-1 border border-[#1F1F1F] bg-black px-2 py-1 text-sm text-white outline-none focus:border-[#00B4FF]"
                      aria-label="Member display name"
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm text-white truncate">{member.userName}</span>
                  )}
                  <span className={cn("tui-badge shrink-0", roleBadgeClass(member.role))}>
                    {member.role.toUpperCase()}
                  </span>
                  {member.status === "rejected" && (
                    <span className="tui-badge shrink-0 border-red-500/50 text-red-400">REJECTED</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {editingName === member._id ? (
                    <>
                      <button onClick={() => handleNameUpdate(member._id)} className="p-1.5 text-[#555555] hover:text-[#00FF41] transition-colors" title="Save name">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={cancelNameEdit} className="px-2 py-1 text-xs text-[#555555] hover:text-white transition-colors" title="Cancel name edit">✕</button>
                    </>
                  ) : changingRole === member._id ? (
                    <div className="flex flex-wrap gap-1">
                      {(["organizer", "judge", "competitor"] as const).map((r) => (
                        <button key={r} onClick={() => handleRoleChange(member._id, r)}
                          className={cn("px-2 py-1 text-xs uppercase tracking-wider transition-colors",
                            member.role === r ? "bg-white text-black" : "border border-[#1F1F1F] text-[#555555] hover:border-white hover:text-white"
                          )}>
                          {r}
                        </button>
                      ))}
                      <button onClick={() => setChangingRole(null)} className="ml-1 px-2 py-1 text-xs text-[#555555] hover:text-white transition-colors">✕</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => startNameEdit(member._id, member.userName)} className="p-1.5 text-[#555555] hover:text-white transition-colors" title="Edit display name">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setChangingRole(member._id)} className="p-1.5 text-[#555555] hover:text-white transition-colors" title="Change role">
                        <Shield className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleRemove(member._id)} className="p-1.5 text-[#555555] hover:text-red-400 transition-colors" title="Remove member">
                        <UserX className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { isSafeHttpUrl } from "@/lib/url";

const DISPLAY_STYLE_OPTIONS = [
  { value: "featured", label: "FEATURED — Full-width banner, large pfp, bold name" },
  { value: "large",    label: "LARGE — Wide banner, pfp overlay, prominent name" },
  { value: "medium",   label: "MEDIUM — Standard banner + pfp" },
  { value: "small",    label: "SMALL — Logo + name only (no banner)" },
] as const;

type DisplayStyle = typeof DISPLAY_STYLE_OPTIONS[number]["value"];

function DisplayStyleBadge({ style }: { style: DisplayStyle | undefined }) {
  const map: Record<DisplayStyle, string> = {
    featured: "FEATURED",
    large: "LARGE",
    medium: "MEDIUM",
    small: "SMALL",
  };
  const colorMap: Record<DisplayStyle, string> = {
    featured: "text-[#FFD700] border-[#FFD700]",
    large: "text-[#C0C0C0] border-[#C0C0C0]",
    medium: "text-[#CD7F32] border-[#CD7F32]",
    small: "text-[#555555] border-[#333333]",
  };
  const s = style ?? "medium";
  return (
    <span className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-widest font-bold ${colorMap[s]}`}>
      {map[s]}
    </span>
  );
}

function SponsorsSection({ hackathonId }: { hackathonId: Id<"hackathons"> }) {
  const sponsors = useQuery(api.sponsors.list, { hackathonId });
  const createSponsor = useMutation(api.sponsors.create);
  const updateSponsor = useMutation(api.sponsors.update);
  const removeSponsor = useMutation(api.sponsors.remove);
  const reorderSponsors = useMutation(api.sponsors.reorder);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPfpUrl, setNewPfpUrl] = useState("");
  const [newBannerUrl, setNewBannerUrl] = useState("");
  const [newWebsiteUrl, setNewWebsiteUrl] = useState("");
  const [newDisplayStyle, setNewDisplayStyle] = useState<DisplayStyle>("medium");
  const [newBadgeText, setNewBadgeText] = useState("");

  // Edit form state
  const [editingId, setEditingId] = useState<Id<"sponsors"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editPfpUrl, setEditPfpUrl] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editDisplayStyle, setEditDisplayStyle] = useState<DisplayStyle>("medium");
  const [editBadgeText, setEditBadgeText] = useState("");

  // Drag-to-reorder state
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (!sponsors) return <SectionSkeleton title="SPONSORS" />;

  const startEdit = (sponsor: NonNullable<typeof sponsors>[number]) => {
    setEditingId(sponsor._id);
    setEditName(sponsor.name);
    setEditPfpUrl(sponsor.pfpUrl ?? "");
    setEditBannerUrl(sponsor.bannerUrl ?? "");
    setEditWebsiteUrl(sponsor.websiteUrl ?? "");
    setEditDisplayStyle((sponsor.displayStyle as DisplayStyle | undefined) ?? "medium");
    setEditBadgeText(sponsor.badgeText ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditPfpUrl("");
    setEditBannerUrl("");
    setEditWebsiteUrl("");
    setEditDisplayStyle("medium");
    setEditBadgeText("");
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createSponsor({
        hackathonId,
        name: newName,
        pfpUrl: newPfpUrl || undefined,
        bannerUrl: newBannerUrl || undefined,
        websiteUrl: newWebsiteUrl || undefined,
        displayStyle: newDisplayStyle,
        badgeText: newBadgeText || undefined,
      });
      toast.success("Sponsor added");
      setNewName("");
      setNewPfpUrl("");
      setNewBannerUrl("");
      setNewWebsiteUrl("");
      setNewDisplayStyle("medium");
      setNewBadgeText("");
      setShowAddForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add sponsor");
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName.trim()) {
      if (editingId && !editName.trim()) toast.error("Sponsor name is required");
      return;
    }
    try {
      await updateSponsor({
        sponsorId: editingId,
        name: editName,
        pfpUrl: editPfpUrl || undefined,
        bannerUrl: editBannerUrl || undefined,
        websiteUrl: editWebsiteUrl || undefined,
        displayStyle: editDisplayStyle,
        badgeText: editBadgeText || undefined,
      });
      toast.success("Sponsor updated");
      setEditingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update sponsor");
    }
  };

  const handleRemove = async (sponsorId: Id<"sponsors">) => {
    try {
      await removeSponsor({ sponsorId });
      toast.success("Sponsor removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove sponsor");
    }
  };

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex || !sponsors) {
      setDragOverIndex(null);
      dragIndexRef.current = null;
      return;
    }
    const reordered = [...sponsors];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setDragOverIndex(null);
    dragIndexRef.current = null;
    try {
      await reorderSponsors({
        hackathonId,
        sponsorIds: reordered.map((s) => s._id),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder sponsors");
    }
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    dragIndexRef.current = null;
  };

  return (
    <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#555555] uppercase tracking-widest">── SPONSORS</span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 border border-[#1F1F1F] px-3 py-1.5 text-xs text-[#555555] uppercase tracking-wider hover:border-[#00FF41] hover:text-[#00FF41] transition-colors"
        >
          {showAddForm ? "[ CANCEL ]" : "[ + ADD ]"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="mb-4 space-y-2 border border-[#1F1F1F] bg-[#111111] p-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Sponsor name"
            className="tui-input"
            required
          />
          <input
            type="url"
            value={newPfpUrl}
            onChange={(e) => setNewPfpUrl(e.target.value)}
            placeholder="Profile image URL (optional)"
            className="tui-input"
          />
          <input
            type="url"
            value={newBannerUrl}
            onChange={(e) => setNewBannerUrl(e.target.value)}
            placeholder="Banner image URL (optional)"
            className="tui-input"
          />
          <input
            type="url"
            value={newWebsiteUrl}
            onChange={(e) => setNewWebsiteUrl(e.target.value)}
            placeholder="Website URL (optional)"
            className="tui-input"
          />
          <input
            type="text"
            value={newBadgeText}
            onChange={(e) => setNewBadgeText(e.target.value)}
            placeholder="Badge text (optional, e.g. GOLD)"
            className="tui-input"
          />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#555555] uppercase tracking-widest">Display Style</label>
            <select
              value={newDisplayStyle}
              onChange={(e) => setNewDisplayStyle(e.target.value as DisplayStyle)}
              className="tui-input"
            >
              {DISPLAY_STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors"
          >
            [ ADD SPONSOR ]
          </button>
        </form>
      )}

      {sponsors.length === 0 ? (
        <p className="text-xs text-[#555555] uppercase tracking-wider">NO SPONSORS YET.</p>
      ) : (
        <div className="space-y-2">
          {sponsors.map((sponsor, index) => (
            <div
              key={sponsor._id}
              className={cn(
                "border bg-[#111111] transition-colors",
                dragOverIndex === index ? "border-[#00FF41]" : "border-[#1F1F1F]"
              )}
              draggable={editingId !== sponsor._id}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              {editingId === sponsor._id ? (
                <form onSubmit={handleUpdate} className="space-y-2 p-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Sponsor name"
                    className="tui-input"
                    required
                    autoFocus
                  />
                  <input
                    type="url"
                    value={editPfpUrl}
                    onChange={(e) => setEditPfpUrl(e.target.value)}
                    placeholder="Profile image URL (optional)"
                    className="tui-input"
                  />
                  <input
                    type="url"
                    value={editBannerUrl}
                    onChange={(e) => setEditBannerUrl(e.target.value)}
                    placeholder="Banner image URL (optional)"
                    className="tui-input"
                  />
                  <input
                    type="url"
                    value={editWebsiteUrl}
                    onChange={(e) => setEditWebsiteUrl(e.target.value)}
                    placeholder="Website URL (optional)"
                    className="tui-input"
                  />
                  <input
                    type="text"
                    value={editBadgeText}
                    onChange={(e) => setEditBadgeText(e.target.value)}
                    placeholder="Badge text (optional, e.g. GOLD)"
                    className="tui-input"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#555555] uppercase tracking-widest">Display Style</label>
                    <select
                      value={editDisplayStyle}
                      onChange={(e) => setEditDisplayStyle(e.target.value as DisplayStyle)}
                      className="tui-input"
                    >
                      {DISPLAY_STYLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors"
                    >
                      [ SAVE ]
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-4 py-1.5 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-[#555555] hover:text-white transition-colors"
                    >
                      CANCEL
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <GripVertical
                      className="h-4 w-4 text-[#333333] cursor-grab active:cursor-grabbing shrink-0"
                      aria-hidden="true"
                    />
                    {sponsor.pfpUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sponsor.pfpUrl}
                        alt={sponsor.name}
                        className="h-8 w-8 rounded-full bg-[#FFFFFF] object-cover border border-[#1F1F1F]"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white uppercase tracking-wide">{sponsor.name}</p>
                        {sponsor.badgeText && (
                          <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{sponsor.badgeText}</span>
                        )}
                        <DisplayStyleBadge style={sponsor.displayStyle as DisplayStyle | undefined} />
                      </div>
                      {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) && (
                        <a
                          href={sponsor.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#555555] hover:text-[#00B4FF] transition-colors"
                        >
                          {sponsor.websiteUrl}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(sponsor)}
                      className="p-1.5 text-[#555555] hover:text-[#00B4FF] transition-colors"
                      title="Edit sponsor"
                      aria-label="Edit sponsor"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(sponsor._id)}
                      className="p-1.5 text-[#555555] hover:text-red-400 transition-colors"
                      title="Remove sponsor"
                      aria-label="Remove sponsor"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamsAndProjectsSection({ hackathonId }: { hackathonId: Id<"hackathons"> }) {
  const teams = useQuery(api.teams.list, { hackathonId });
  const updateTeamName = useMutation(api.teams.updateTeamName);

  const [editingTeamId, setEditingTeamId] = useState<Id<"teams"> | null>(null);
  const [editTeamName, setEditTeamName] = useState("");

  if (!teams) return <SectionSkeleton title="TEAMS" />;

  const startEditingTeam = (team: { _id: Id<"teams">; name: string }) => {
    setEditingTeamId(team._id); setEditTeamName(team.name);
  };

  const handleSaveTeamName = async (teamId: Id<"teams">) => {
    if (!editTeamName.trim()) return;
    try {
      await updateTeamName({ teamId, name: editTeamName });
      toast.success("Team name updated");
      setEditingTeamId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update team");
    }
  };

  return (
    <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
      {sectionHeader("TEAMS")}
      {teams.length === 0 ? (
        <p className="text-xs text-[#555555] uppercase tracking-wider">NO TEAMS HAVE JOINED YET.</p>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <div key={team._id} className="border border-[#1F1F1F] bg-[#111111] p-4">
              {editingTeamId === team._id ? (
                <div className="mb-3 flex items-center gap-2">
                  <input type="text" className="tui-input flex-1" value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} placeholder="Team Name" />
                  <button onClick={() => handleSaveTeamName(team._id)} className="px-3 py-1.5 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider hover:bg-white transition-colors">SAVE</button>
                  <button onClick={() => setEditingTeamId(null)} className="px-3 py-1.5 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors">CANCEL</button>
                </div>
              ) : (
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wide">
                    {team.name}
                  </h4>
                  <button onClick={() => startEditingTeam(team)} className="p-1.5 text-[#555555] hover:text-white transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {team.members?.map((m: { _id: string; userName: string }) => (
                  <span key={m._id} className="border border-[#1F1F1F] bg-black px-2 py-0.5 text-xs text-[#555555]">
                    {m.userName}
                  </span>
                ))}
                {(!team.members || team.members.length === 0) && (
                  <span className="text-xs text-[#333333] uppercase">NO MEMBERS</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
