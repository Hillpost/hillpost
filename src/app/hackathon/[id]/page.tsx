"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { getClerkDisplayName } from "@/lib/clerk-user";
import { format } from "date-fns";
import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Trophy,
  Settings,
  Code,
  Gavel,
  ArrowLeft,
  Calendar,
  Clock,
  Check,
  Link as LinkIcon,
  LogOut,
  ExternalLink,
  UserPlus,
} from "lucide-react";
import { OrganizerPanel } from "@/components/organizer-panel";
import { CompetitorPanel } from "@/components/competitor-panel";
import { JudgePanel } from "@/components/judge-panel";
import { PublicSubmissions } from "@/components/public-submissions";
import { QrCodeButton } from "@/components/qr-code-overlay";
import { PublicHackathonLanding } from "@/components/public-hackathon-landing";

import { isSafeHttpUrl } from "@/lib/url";

const ALL_TABS = ["overview", "submissions", "compete", "judge", "manage"] as const;
type Tab = (typeof ALL_TABS)[number];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const roleColor = (role: string) => {
  switch (role) {
    case "organizer": return "border-[#FF6600] text-[#FF6600]";
    case "judge": return "border-[#00B4FF] text-[#00B4FF]";
    case "competitor": return "border-[#00FF41] text-[#00FF41]";
    default: return "border-[#555555] text-[#555555]";
  }
};

export default function HackathonDetailPage() {
  const params = useParams();
  const { user } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const hackathonId = params.id as Id<"hackathons">;
  const hackathon = useQuery(api.hackathons.get, { hackathonId });
  const membership = useQuery(api.members.getMyMembership, { hackathonId });
  const role = membership?.role;
  const publicJudges = useQuery(api.members.listPublicJudges, { hackathonId });

  const submissions = useQuery(api.submissions.list, { hackathonId });
  const allMembers = useQuery(api.members.listMembers, role === "organizer" ? { hackathonId } : "skip");
  const categories = useQuery(api.categories.list, { hackathonId });
  const tracks = useQuery(api.tracks.list, { hackathonId });
  const sponsors = useQuery(api.sponsors.list, { hackathonId });
  const featuredSponsors = sponsors?.filter((s) => (s.displayStyle ?? "medium") === "featured") ?? [];
  const largeSponsors = sponsors?.filter((s) => (s.displayStyle ?? "medium") === "large") ?? [];
  const mediumSponsors = sponsors?.filter((s) => (s.displayStyle ?? "medium") === "medium") ?? [];
  const smallSponsors = sponsors?.filter((s) => (s.displayStyle ?? "medium") === "small") ?? [];
  const leaveHackathon = useMutation(api.members.leaveHackathon);
  const joinPublic = useMutation(api.hackathons.joinPublic);
  const syncProfile = useMutation(api.members.syncUserProfile);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isJoiningPublic, setIsJoiningPublic] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const userId = user?.id;

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const current = new Date();
    const nextMidnight = new Date(current);
    nextMidnight.setHours(24, 0, 0, 0);

    const timeout = setTimeout(() => {
      setNow(Date.now());
      interval = setInterval(() => setNow(Date.now()), ONE_DAY_MS);
    }, nextMidnight.getTime() - current.getTime());

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (isAuthenticated && membership && user?.imageUrl) {
      syncProfile({
        hackathonId,
        userImageUrl: user.imageUrl,
      }).catch(console.error);
    }
  }, [isAuthenticated, user?.imageUrl, membership, hackathonId, syncProfile]);

  // No useEffect redirect — private hackathons return null from the backend for
  // unauthenticated callers (hackathons.get), so the render gate below handles it.

  const tabParam = searchParams.get("tab");
  const parsedTab = (ALL_TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : null;
  const activeTab: Tab = parsedTab ?? "overview";
  const [copiedJoinLink, setCopiedJoinLink] = useState(false);

  const handleTabChange = (tab: Tab) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", tab);
    }
    const qs = newParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const copyCompetitorJoinLink = async () => {
    if (!hackathon?.competitorJoinCode) return;
    try {
      const link = `${window.location.origin}/join/${hackathon.competitorJoinCode}`;
      await navigator.clipboard.writeText(link);
      setCopiedJoinLink(true);
      toast.success("Join link copied!");
      setTimeout(() => setCopiedJoinLink(false), 2000);
    } catch (error) {
      console.error("Failed to copy join link to clipboard:", error);
      toast.error("Failed to copy join link. Please try again.");
    }
  };

  const pendingSubmissionsCount = React.useMemo(() => {
    if (role !== "judge" && role !== "organizer") return 0;
    if (membership?.status === "pending" || membership?.status === "rejected") return 0;
    if (!submissions || !userId) return 0;
    return submissions.filter((sub) => {
      const hasJudged = sub.judgedBy?.includes(userId) ?? false;
      return !hasJudged;
    }).length;
  }, [role, membership?.status, submissions, userId]);

  const pendingApprovalsCount = React.useMemo(() => {
    if (role !== "organizer" || !allMembers) return 0;
    return allMembers.filter((m) => m.status === "pending").length;
  }, [role, allMembers]);

  const isMembershipLoading = membership === undefined || isLoading;

  if (hackathon === undefined || isMembershipLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-64 border border-[#1F1F1F] bg-[#0A0A0A] flex items-center justify-center">
          <span className="text-xs text-[#555555] uppercase tracking-widest">
            ▓▓▓░░░ LOADING HACKATHON...
          </span>
        </div>
      </div>
    );
  }

  const handleLeave = async () => {
    if (!user?.id || hackathon?.organizerId === user.id) return;
    if (confirm("Are you sure you want to leave this hackathon?")) {
      setIsLeaving(true);
      try {
        await leaveHackathon({ hackathonId });
        router.push("/dashboard");
      } catch (error) {
        console.error("Failed to leave hackathon:", error);
        setIsLeaving(false);
      }
    }
  };

  const handlePublicJoin = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in first");
      return;
    }

    setIsJoiningPublic(true);
    try {
      const result = await joinPublic({
        hackathonId,
        userName: getClerkDisplayName(user),
        userImageUrl: user?.imageUrl,
      });
      if (result.alreadyMember) {
        toast.info("You're already a member — redirecting...");
      } else {
        toast.success("Successfully joined the hackathon!");
      }
      router.push(`/hackathon/${result.hackathonId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join hackathon";
      toast.error(message);
    } finally {
      setIsJoiningPublic(false);
    }
  };

  if (!hackathon) {
    if (!isAuthenticated) {
      const redirectUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold">Sign in to view this hackathon</h1>
          <p className="text-sm text-muted-foreground">
            This hackathon is private. Sign in to access it.
          </p>
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8 text-center">
          <p className="text-sm text-[#555555] uppercase tracking-wide">Hackathon not found</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Unauthenticated visitors of a public hackathon get a purpose-built landing page.
  if (!isAuthenticated && hackathon.isPublic === true) {
    return (
      <PublicHackathonLanding
        hackathon={hackathon}
        hackathonId={hackathonId}
        categories={categories}
        sponsors={sponsors}
        publicJudges={publicJudges}
      />
    );
  }

  const isCreator = user?.id === hackathon.organizerId;
  const isPublicHackathon = hackathon.isPublic === true;
  const scoresVisibleToCompetitors = hackathon.scoresVisible !== false;
  const daysLeft = Math.max(0, Math.ceil((hackathon.endDate - now) / (1000 * 60 * 60 * 24)));

  const tabs: { id: Tab; label: string; show: boolean; badge?: number }[] = [
    { id: "overview", label: "OVERVIEW", show: true },
    { id: "submissions", label: (role === "organizer" || isCreator) ? "PROJECTS" : "SUBMISSIONS", show: role !== "competitor" && role !== "judge" },
    { id: "compete", label: "COMPETE", show: role === "competitor" },
    {
      id: "judge",
      label: "JUDGE",
      show: role === "judge" || role === "organizer" || isCreator,
      badge: pendingSubmissionsCount,
    },
    {
      id: "manage",
      label: "MANAGE",
      show: role === "organizer" || isCreator,
      badge: pendingApprovalsCount,
    },
  ];

  const activeTabConfig = tabs.find((t) => t.id === activeTab);
  if (activeTabConfig && !activeTabConfig.show) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8 text-center">
          <p className="text-sm text-white uppercase tracking-wide">404 — Page Not Found</p>
          <p className="mt-2 text-xs text-[#555555]">The requested section could not be found or you do not have permission to access it.</p>
          <button
            onClick={() => handleTabChange("overview")}
            className="mt-4 inline-flex items-center gap-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white uppercase tracking-wide">{hackathon.name}</h1>
          </div>
          <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end">
            {hackathon.isActive ? (
              <span className="flex items-center gap-2 text-xs text-[#00FF41] uppercase tracking-widest border border-[#00FF41]/30 px-2.5 py-1">
                <span className="status-pulse h-1.5 w-1.5 bg-[#00FF41] inline-block" />
                [ ACTIVE ]
              </span>
            ) : (
              <span className="flex items-center gap-2 text-xs text-[#555555] uppercase tracking-widest border border-[#1F1F1F] px-2.5 py-1">
                <span className="h-1.5 w-1.5 bg-[#555555] inline-block" />
                [ INACTIVE ]
              </span>
            )}
            {membership && hackathon.organizerId !== user?.id && (
              <button
                onClick={handleLeave}
                disabled={isLeaving}
                className="flex items-center gap-1.5 border border-red-500/20 px-3 py-1 text-xs text-red-400 uppercase tracking-wider hover:border-red-500 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                <LogOut className="h-3 w-3" />
                {isLeaving ? "LEAVING..." : "[ LEAVE ]"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#555555]">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(hackathon.startDate), "MMM d, yyyy")} —{" "}
            {format(new Date(hackathon.endDate), "MMM d, yyyy")}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {hackathon.submissionFrequencyMinutes}min cooldown
          </span>
          {role && (
            <span className={cn("tui-badge", roleColor(role))}>
              {role.toUpperCase()}
            </span>
          )}
          <span className="tui-badge border-[#555555] text-[#555555]">
            {daysLeft} {daysLeft === 1 ? "DAY" : "DAYS"} LEFT
          </span>
        </div>
      </div>

      {isPublicHackathon && !role && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-[#00FF41]/20 bg-[#00FF41]/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#00FF41]" />
            <span className="text-xs font-bold text-[#00FF41] uppercase tracking-wider">PUBLIC EVENT</span>
            <span className="text-xs text-[#555555]">— open registration</span>
          </div>
          <button
            onClick={handlePublicJoin}
            disabled={isJoiningPublic}
            className="inline-flex items-center gap-2 border border-[#00FF41] px-4 py-1.5 text-xs font-bold text-[#00FF41] uppercase tracking-wider hover:bg-[#00FF41] hover:text-black transition-colors disabled:opacity-60"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {isJoiningPublic ? "JOINING..." : "JOIN AS COMPETITOR"}
          </button>
        </div>
      )}

      {/* TUI Tabs */}
      <div className="mb-6 flex gap-0 overflow-x-auto border border-[#1F1F1F]">
        {tabs
          .filter((t) => t.show)
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap border-r border-[#1F1F1F] last:border-r-0",
                activeTab === tab.id
                  ? "bg-white text-black"
                  : "bg-black text-[#555555] hover:text-white"
              )}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 text-[10px] font-bold text-[#FF6600]">
                  ●{tab.badge}
                </span>
              )}
            </button>
          ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats Grid */}
          {role === "organizer" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "BUILDERS",
                value: allMembers?.filter((m) => m.role === "competitor").length ?? "—",
                color: "#00B4FF",
                onClick: undefined,
              },
              {
                label: "PROJECTS",
                value: submissions?.length ?? "—",
                color: "#00FF41",
                onClick: () => handleTabChange("submissions"),
              },
              {
                label: "CATEGORIES",
                value: categories?.length ?? "—",
                color: "#FF6600",
                onClick: undefined,
              },
              {
                label: "DAYS LEFT",
                value: daysLeft,
                color: "#555555",
                onClick: undefined,
              },
            ].map(({ label, value, color, onClick }) => (
              <div
                key={label}
                onClick={onClick}
                onKeyDown={onClick ? (e) => { if (e.repeat) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
                className={cn(
                  "border border-[#1F1F1F] bg-[#0A0A0A] p-4 text-center",
                  onClick && "cursor-pointer hover:border-[#00FF41] transition-colors"
                )}
              >
                <div className="mb-1 text-xs text-[#555555] uppercase tracking-widest">
                  ─ {label} ─
                </div>
                <div className="text-2xl font-bold tabular-nums" style={{ color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {(role === "organizer" || role === "judge" || (role === "competitor" && scoresVisibleToCompetitors)) && (
              <Link
                href={`/hackathon/${hackathonId}/leaderboard`}
                className="group flex flex-col justify-center gap-4 border border-[#1F1F1F] bg-[#0A0A0A] p-6 transition-colors hover:border-[#FF6600]"
              >
                <div className="flex items-center gap-4">
                  <Trophy className="h-8 w-8 text-[#FF6600]" />
                  <div>
                    <p className="text-sm font-bold text-white uppercase tracking-wide group-hover:text-[#FF6600] transition-colors">
                      VIEW LEADERBOARD →
                    </p>
                    <p className="text-xs text-[#555555]">
                      See real-time rankings and scores
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {role === "judge" ? (
              membership?.status === "approved" ? (
                <div className="flex flex-col justify-center border border-[#1F1F1F] bg-[#0A0A0A] p-6">
                  <h3 className="mb-4 text-xs font-bold text-[#555555] uppercase tracking-widest">
                    ─ JUDGING STATUS ─
                  </h3>
                  <div className="flex items-center gap-4">
                    <Gavel className="h-8 w-8 text-[#00B4FF]" />
                    <div>
                      {pendingSubmissionsCount > 0 ? (
                        <>
                          <p className="text-xl font-bold text-white tabular-nums">
                            {pendingSubmissionsCount} PENDING
                          </p>
                          <p className="text-xs text-[#555555]">
                            Waiting to be scored
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-bold text-[#00FF41]">ALL CAUGHT UP</p>
                          <p className="text-xs text-[#555555]">
                            Check back later for more
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {pendingSubmissionsCount > 0 && (
                    <button
                      onClick={() => handleTabChange("judge")}
                      className="mt-6 w-full border border-[#00B4FF] py-2 text-xs font-bold text-[#00B4FF] uppercase tracking-wider transition-colors hover:bg-[#00B4FF] hover:text-black"
                    >
                      [ START JUDGING → ]
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border border-[#FF6600]/20 bg-[#FF660008] p-6 text-center">
                  <Gavel className="mb-4 h-8 w-8 text-[#FF6600]" />
                  <h3 className="mb-2 text-sm font-bold text-white uppercase">
                    APPROVAL PENDING
                  </h3>
                  <p className="text-xs text-[#555555]">
                    Your request to judge is waiting for organizer approval.
                  </p>
                </div>
              )
            ) : (role === "organizer" || role === "competitor") ? (
              <div className="flex flex-col justify-center border border-[#1F1F1F] bg-[#0A0A0A] p-6">
                <h3 className="mb-2 text-xs font-bold text-[#555555] uppercase tracking-widest">
                  ─ COMPETITOR JOIN CODE ─
                </h3>
                <div className="flex flex-col gap-2">
                  <code className="border border-[#1F1F1F] bg-black px-4 py-2 text-lg tracking-widest text-[#00FF41] font-bold break-all">
                    {hackathon?.competitorJoinCode ?? "—"}
                  </code>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyCompetitorJoinLink}
                      className="border border-[#1F1F1F] p-2 text-[#555555] hover:border-white hover:text-white transition-colors"
                      title="Copy join link"
                      aria-label="Copy join link"
                    >
                      {copiedJoinLink ? (
                        <Check className="h-4 w-4 text-[#00FF41]" />
                      ) : (
                        <LinkIcon className="h-4 w-4" />
                      )}
                    </button>
                    {hackathon?.competitorJoinCode && (
                      <QrCodeButton
                        path={`/join/${hackathon.competitorJoinCode}`}
                        label="Competitor Join QR"
                      />
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-[#333333]">
                  Share this code or copy the join link to invite competitors.
                </p>
              </div>
            ) : null}
          </div>

          {/* Sponsors Section */}
          {sponsors && sponsors.length > 0 && (
            <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs text-[#555555] uppercase tracking-widest">── SPONSORS</span>
                <div className="h-px flex-1 bg-[#1F1F1F]" />
              </div>

              {/* Featured sponsors — full-width rows */}
              {featuredSponsors.length > 0 && (
                <div className="mb-6 space-y-4">
                  {featuredSponsors.map((sponsor) => {
                    const imageContent = sponsor.bannerUrl ? (
                      <div className="relative w-full overflow-hidden border border-[#1F1F1F] bg-[#111111]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sponsor.bannerUrl} alt={`${sponsor.name} banner`} className="h-36 w-full object-cover" />
                        {sponsor.pfpUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sponsor.pfpUrl} alt={sponsor.name} className="absolute bottom-2 left-3 h-14 w-14 rounded-full bg-[#FFFFFF] border-2 border-[#0A0A0A] object-cover" />
                        )}
                      </div>
                    ) : (
                      <div className="flex w-full items-center justify-center h-36 border border-[#1F1F1F] bg-[#111111]">
                        {sponsor.pfpUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sponsor.pfpUrl} alt={sponsor.name} className="h-20 w-20 rounded-full bg-[#FFFFFF] border border-[#1F1F1F] object-cover" />
                        )}
                      </div>
                    );

                    return (
                    <div key={sponsor._id} className="flex flex-col items-start gap-3 w-full group">
                      {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) ? (
                        <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="w-full block" aria-label={`${sponsor.name} website`}>
                          {imageContent}
                        </a>
                      ) : imageContent}
                      {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) ? (
                        <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-base font-bold text-white uppercase tracking-wide group-hover:text-[#00B4FF] transition-colors" aria-hidden="true" tabIndex={-1}>
                          {sponsor.name}
                          {sponsor.badgeText && (
                            <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{sponsor.badgeText}</span>
                          )}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <p className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                          {sponsor.name}
                          {sponsor.badgeText && (
                            <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{sponsor.badgeText}</span>
                          )}
                        </p>
                      )}
                    </div>
                  )})}
                </div>
              )}

              {/* Large sponsors */}
              {largeSponsors.length > 0 && (
                <div className="flex flex-wrap gap-4 items-start mb-4">
                  {largeSponsors.map((sponsor) => {
                    const imageContent = sponsor.bannerUrl ? (
                      <div className="relative w-full overflow-hidden border border-[#1F1F1F] bg-[#111111]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sponsor.bannerUrl} alt={`${sponsor.name} banner`} className="h-28 w-full object-cover" />
                        {sponsor.pfpUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sponsor.pfpUrl} alt={sponsor.name} className="absolute bottom-2 left-2 h-12 w-12 rounded-full bg-[#FFFFFF] border-2 border-[#0A0A0A] object-cover" />
                        )}
                      </div>
                    ) : (
                      <div className="flex w-full items-center justify-center h-28 border border-[#1F1F1F] bg-[#111111]">
                        {sponsor.pfpUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sponsor.pfpUrl} alt={sponsor.name} className="h-16 w-16 rounded-full bg-[#FFFFFF] border border-[#1F1F1F] object-cover" />
                        )}
                      </div>
                    );

                    return (
                    <div key={sponsor._id} className="flex w-72 max-w-full min-w-0 flex-col items-start gap-2 group overflow-hidden">
                      {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) ? (
                        <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="w-full block" aria-label={`${sponsor.name} website`}>
                          {imageContent}
                        </a>
                      ) : imageContent}
                      {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) ? (
                        <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-bold text-white uppercase tracking-wide group-hover:text-[#00B4FF] transition-colors" aria-hidden="true" tabIndex={-1}>
                          {sponsor.name}
                          {sponsor.badgeText && (
                            <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{sponsor.badgeText}</span>
                          )}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <p className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-1">
                          {sponsor.name}
                          {sponsor.badgeText && (
                            <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{sponsor.badgeText}</span>
                          )}
                        </p>
                      )}
                    </div>
                  )})}
                </div>
              )}

              {/* Medium sponsors */}
              {mediumSponsors.length > 0 && (
                <div className="flex flex-wrap gap-4 items-start mb-4">
                  {mediumSponsors.map((sponsor) => {
                    const imageContent = sponsor.bannerUrl ? (
                      <div className="relative w-full overflow-hidden border border-[#1F1F1F] bg-[#111111]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sponsor.bannerUrl} alt={`${sponsor.name} banner`} className="h-20 w-full object-cover" />
                        {sponsor.pfpUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sponsor.pfpUrl} alt={sponsor.name} className="absolute bottom-1 left-2 h-8 w-8 rounded-full bg-[#FFFFFF] border-2 border-[#0A0A0A] object-cover" />
                        )}
                      </div>
                    ) : (
                      <div className="flex w-full items-center justify-center h-20 border border-[#1F1F1F] bg-[#111111]">
                        {sponsor.pfpUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sponsor.pfpUrl} alt={sponsor.name} className="h-12 w-12 rounded-full bg-[#FFFFFF] border border-[#1F1F1F] object-cover" />
                        )}
                      </div>
                    );

                    return (
                      <div key={sponsor._id} className="flex w-48 max-w-full min-w-0 flex-col items-start gap-2 group overflow-hidden">
                        {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) ? (
                          <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="w-full block" aria-label={`${sponsor.name} website`}>
                            {imageContent}
                          </a>
                        ) : imageContent}
                        {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) ? (
                          <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-white uppercase tracking-wide group-hover:text-[#00B4FF] transition-colors" aria-hidden="true" tabIndex={-1}>
                            {sponsor.name}
                            {sponsor.badgeText && (
                              <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{sponsor.badgeText}</span>
                            )}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1">
                            {sponsor.name}
                            {sponsor.badgeText && (
                              <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{sponsor.badgeText}</span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Small sponsors */}
              {smallSponsors.length > 0 && (
                <div className="flex flex-wrap gap-4 items-start">
                  {smallSponsors.map((sponsor) => {
                    const imageContent = sponsor.pfpUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sponsor.pfpUrl} alt={sponsor.name} className="h-12 w-12 rounded-full bg-[#FFFFFF] border border-[#1F1F1F] object-cover" />
                    ) : null;

                    return (
                      <div key={sponsor._id} className="flex flex-col items-start gap-1.5 group">
                        {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) && imageContent ? (
                          <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="block">
                            {imageContent}
                          </a>
                        ) : imageContent}
                        {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) ? (
                          <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-white uppercase tracking-wide group-hover:text-[#00B4FF] transition-colors">
                            {sponsor.name}
                            {sponsor.badgeText && (
                              <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{sponsor.badgeText}</span>
                            )}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1">
                            {sponsor.name}
                            {sponsor.badgeText && (
                              <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{sponsor.badgeText}</span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


          {tracks && tracks.length > 0 && (
            <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs text-[#555555] uppercase tracking-widest">── TRACKS</span>
                <div className="h-px flex-1 bg-[#1F1F1F]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {tracks.map((track) => (
                  <div key={track._id} className="border border-[#1F1F1F] bg-[#111111] p-4 transition-colors hover:border-[#2a2a2a]">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-bold text-white uppercase tracking-wide">{track.name}</p>
                      <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">
                        {track.teamIds.length} {track.teamIds.length === 1 ? "TEAM" : "TEAMS"}
                      </span>
                    </div>
                    {track.description && (
                      <p className="text-xs text-[#555555] leading-relaxed whitespace-pre-wrap break-words">{track.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {categories && categories.length > 0 && (
            <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs text-[#555555] uppercase tracking-widest">── JUDGING CRITERIA</span>
                <div className="h-px flex-1 bg-[#1F1F1F]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {categories.map((cat) => (
                  <div key={cat._id} className="border border-[#1F1F1F] bg-[#111111] p-4 transition-colors hover:border-[#2a2a2a]">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-bold text-white uppercase tracking-wide">{cat.name}</p>
                      <span className="tui-badge border-[#00FF41] text-[#00FF41]">
                        {cat.maxScore} PTS
                      </span>
                    </div>
                    <p className="text-xs text-[#555555] leading-relaxed whitespace-pre-wrap break-words">{cat.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isPublicHackathon && publicJudges && publicJudges.length > 0 && (
            <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-xs text-[#555555] uppercase tracking-widest">── JUDGES</span>
                <div className="h-px flex-1 bg-[#1F1F1F]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {publicJudges.map((judge) => (
                  <div key={judge._id} className="flex items-center gap-3 border border-[#1F1F1F] bg-[#111111] p-3">
                    {judge.userImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={judge.userImageUrl} alt={judge.userName} className="h-9 w-9 border border-[#1F1F1F] object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center border border-[#1F1F1F] text-[#555555] text-xs">
                        J
                      </div>
                    )}
                    <span className="text-sm font-bold text-white uppercase tracking-wide">{judge.userName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "submissions" && (
        <PublicSubmissions hackathonId={hackathonId} role={role} />
      )}

      {activeTab === "manage" && (
        <OrganizerPanel hackathonId={hackathonId} hackathon={hackathon} />
      )}

      {activeTab === "compete" && (
        <CompetitorPanel hackathonId={hackathonId} hackathon={hackathon} />
      )}

      {activeTab === "judge" && (
        <JudgePanel hackathonId={hackathonId} hackathon={hackathon} />
      )}
    </div>
  );
}
