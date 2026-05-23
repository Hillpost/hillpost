"use client";

import { motion } from "framer-motion";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { ExternalLink, ArrowRight, Trophy, Zap, Users, Clock } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { isSafeHttpUrl } from "@/lib/url";
import { useEffect, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

// ─── Prop types ───────────────────────────────────────────────────────────────

type PublicHackathon = {
  _id: Id<"hackathons">;
  name: string;
  description: string;
  startDate: number;
  submissionsStartDate?: number;
  submissionsEndDate?: number;
  endDate: number;
  isActive: boolean;
  isPublic?: boolean;
  openGraphImageUrl?: string;
  scoresVisible?: boolean | "all" | "judges" | "none";
};

type PublicCategory = {
  _id: Id<"categories">;
  name: string;
  description: string;
  maxScore: number;
};

type PublicSponsor = {
  _id: Id<"sponsors">;
  name: string;
  pfpUrl?: string;
  bannerUrl?: string;
  websiteUrl?: string;
  badgeText?: string;
  displayStyle?: "featured" | "large" | "medium" | "small";
};

type PublicJudge = {
  _id: Id<"hackathonMembers">;
  userName: string;
  userImageUrl?: string;
};

export interface PublicHackathonLandingProps {
  hackathon: PublicHackathon;
  hackathonId: Id<"hackathons">;
  categories: PublicCategory[] | undefined;
  sponsors: PublicSponsor[] | undefined;
  publicJudges: PublicJudge[] | undefined;
  isAuthenticated?: boolean;
  isJoining?: boolean;
  onJoin?: () => void | Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type EventStatus = "live" | "upcoming" | "ended";

function getEventStatus(
  startDate: number,
  endDate: number,
  now: number
): EventStatus {
  if (now > endDate) return "ended";
  if (now < startDate) return "upcoming";
  return "live";
}

function getCountdownLabel(startDate: number, endDate: number, status: EventStatus, now: number): string {
  if (status === "upcoming") {
    const days = differenceInDays(startDate, now);
    if (days >= 1) return `Starts in ${days} day${days === 1 ? "" : "s"}`;
    const hours = differenceInHours(startDate, now);
    if (hours >= 1) return `Starts in ${hours} hour${hours === 1 ? "" : "s"}`;
    return "Starting soon";
  }
  if (status === "live") {
    const days = differenceInDays(endDate, now);
    if (days >= 1) return `${days} day${days === 1 ? "" : "s"} left`;
    const hours = differenceInHours(endDate, now);
    if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} left`;
    return "Ending soon";
  }
  return "Event ended";
}

// Primary CTA button: sign out visitors in, signed-in visitors join directly.
function RegisterButton({
  hackathonId,
  large,
  isAuthenticated,
  isJoining,
  onJoin,
}: {
  hackathonId: Id<"hackathons">;
  large?: boolean;
  isAuthenticated?: boolean;
  isJoining?: boolean;
  onJoin?: () => void | Promise<void>;
}) {
  const className = cn(
    "group inline-flex items-center gap-2 border border-[#00FF41] bg-[#00FF41] font-bold text-black uppercase tracking-wider transition-all hover:bg-white hover:border-white disabled:cursor-not-allowed disabled:opacity-60",
    large ? "px-8 py-3.5 text-sm" : "w-full justify-center px-6 py-3 text-xs"
  );
  const label = isJoining ? "Joining..." : "Register as Competitor";

  if (isAuthenticated && onJoin) {
    return (
      <button type="button" onClick={onJoin} disabled={isJoining} className={className}>
        {label}
        <ArrowRight className={cn("transition-transform group-hover:translate-x-0.5", large ? "h-4 w-4" : "h-3.5 w-3.5")} />
      </button>
    );
  }

  return (
    <SignInButton mode="redirect" forceRedirectUrl={`/hackathon/${hackathonId}`}>
      <button className={className}>
        {label}
        <ArrowRight className={cn("transition-transform group-hover:translate-x-0.5", large ? "h-4 w-4" : "h-3.5 w-3.5")} />
      </button>
    </SignInButton>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 text-xs font-bold text-[#555555] uppercase tracking-[0.2em]">
      {children}
    </h2>
  );
}

// Wraps sponsor image/name in a link when a safe URL exists
function MaybeSponsorLink({ sponsor, children, className }: { sponsor: PublicSponsor; children: React.ReactNode; className?: string }) {
  if (sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl)) {
    return (
      <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className={className} aria-label={`${sponsor.name} website`}>
        {children}
      </a>
    );
  }
  return <div className={className}>{children}</div>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PublicHackathonLanding({
  hackathon,
  hackathonId,
  categories,
  sponsors,
  publicJudges,
  isAuthenticated,
  isJoining,
  onJoin,
}: PublicHackathonLandingProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(interval);
  }, []);
  const status = getEventStatus(hackathon.startDate, hackathon.endDate, now);
  const publicRegistrationCloseAt = hackathon.submissionsEndDate ?? hackathon.endDate;
  const isPublicRegistrationOpen = now <= publicRegistrationCloseAt;
  const countdown = getCountdownLabel(hackathon.startDate, hackathon.endDate, status, now);
  const totalPoints = categories?.reduce((sum, c) => sum + c.maxScore, 0) ?? 0;

  const featuredSponsors = sponsors?.filter((s) => (s.displayStyle ?? "medium") === "featured") ?? [];
  const largeSponsors   = sponsors?.filter((s) => (s.displayStyle ?? "medium") === "large") ?? [];
  const mediumSponsors  = sponsors?.filter((s) => (s.displayStyle ?? "medium") === "medium") ?? [];
  const smallSponsors   = sponsors?.filter((s) => (s.displayStyle ?? "medium") === "small") ?? [];

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      {hackathon.openGraphImageUrl ? (
        /* Banner image hero */
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hackathon.openGraphImageUrl}
            alt={hackathon.name}
            className="h-[55vh] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end px-6 pb-10 sm:px-12 sm:pb-14">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <StatusPill status={status} countdown={countdown} />
              <h1 className="mt-4 text-4xl font-bold uppercase leading-none tracking-tight text-white sm:text-6xl md:text-7xl">
                {hackathon.name}
              </h1>
              <p className="mt-3 max-w-xl text-sm text-white/60">
                {format(new Date(hackathon.startDate), "MMMM d, yyyy h:mm a")} –{" "}
                {format(new Date(hackathon.endDate), "MMMM d, yyyy h:mm a")}
                &nbsp;·&nbsp;Public event
              </p>
              {isPublicRegistrationOpen && (
                <div className="mt-6">
                  <RegisterButton hackathonId={hackathonId} isAuthenticated={isAuthenticated} isJoining={isJoining} onJoin={onJoin} large />
                </div>
              )}
            </motion.div>
          </div>
        </div>
      ) : (
        /* No-image typographic hero */
        <div className="relative overflow-hidden dot-grid pt-20 pb-16 sm:pt-28 sm:pb-20">
          {/* Green glow behind the title */}
          <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-[#00FF41] opacity-[0.04] blur-[120px]" />
          <div className="pointer-events-none absolute inset-3 hidden sm:block">
            <div className="absolute top-0 left-0 h-10 w-10 border-l border-t border-[#1F1F1F]" />
            <div className="absolute top-0 right-0 h-10 w-10 border-r border-t border-[#1F1F1F]" />
            <div className="absolute bottom-0 left-0 h-10 w-10 border-b border-l border-[#1F1F1F]" />
            <div className="absolute bottom-0 right-0 h-10 w-10 border-b border-r border-[#1F1F1F]" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8"
          >
            <StatusPill status={status} countdown={countdown} />
            <h1 className="mt-5 text-4xl font-bold uppercase leading-none tracking-tight text-white sm:text-6xl md:text-7xl">
              {hackathon.name}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#777777]">
              {format(new Date(hackathon.startDate), "MMMM d, yyyy h:mm a")} –{" "}
              {format(new Date(hackathon.endDate), "MMMM d, yyyy h:mm a")}
              &nbsp;·&nbsp;Public &amp; free to enter
            </p>
            {isPublicRegistrationOpen && (
              <div className="mt-8 flex flex-col items-start gap-2">
                <RegisterButton hackathonId={hackathonId} isAuthenticated={isAuthenticated} isJoining={isJoining} onJoin={onJoin} large />
                <p className="text-[11px] text-[#333333] uppercase tracking-wider">
                  {isAuthenticated ? "No invite code · join instantly" : "No invite code · just sign in"}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── Body: 2-column layout ──────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">

          {/* ── Main column ──────────────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-12">

            {/* About */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <SectionHeading>About</SectionHeading>
              <p className="text-sm leading-7 text-[#AAAAAA] whitespace-pre-wrap">
                {hackathon.description}
              </p>
            </motion.section>

            {/* Timeline */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <SectionHeading>Timeline</SectionHeading>
              <div className="relative">
                {/* Connecting line */}
                <div className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-[#1F1F1F]" />
                <ol className="space-y-6 pl-6">
                  {[
                    {
                      label: "Public registration",
                      date: `Until ${format(new Date(publicRegistrationCloseAt), "EEEE, MMMM d, yyyy h:mm a")}`,
                      done: !isPublicRegistrationOpen,
                      accent: "#00FF41",
                      active: isPublicRegistrationOpen,
                    },
                    {
                      label: "Hacking begins",
                      date: format(new Date(hackathon.startDate), "EEEE, MMMM d, yyyy h:mm a"),
                      done: now >= hackathon.startDate,
                      accent: "#00B4FF",
                      active: false,
                    },
                    ...(hackathon.submissionsStartDate && hackathon.submissionsStartDate !== hackathon.startDate
                      ? [{
                          label: "Submissions open",
                          date: format(new Date(hackathon.submissionsStartDate), "EEEE, MMMM d, yyyy h:mm a"),
                          done: now >= hackathon.submissionsStartDate,
                          accent: "#00FF41",
                          active: now >= hackathon.startDate && now < hackathon.submissionsStartDate,
                        }]
                      : []),
                    {
                      label: "Submissions close",
                      date: format(new Date(hackathon.submissionsEndDate ?? hackathon.endDate), "EEEE, MMMM d, yyyy h:mm a"),
                      done: now >= (hackathon.submissionsEndDate ?? hackathon.endDate),
                      accent: "#FF6600",
                      active:
                        now >= (hackathon.submissionsStartDate ?? hackathon.startDate) &&
                        now < (hackathon.submissionsEndDate ?? hackathon.endDate),
                    },
                    ...(hackathon.submissionsEndDate && hackathon.submissionsEndDate !== hackathon.endDate
                      ? [{
                          label: "Event ends",
                          date: format(new Date(hackathon.endDate), "EEEE, MMMM d, yyyy h:mm a"),
                          done: now >= hackathon.endDate,
                          accent: "#FF6600",
                          active: false,
                        }]
                      : []),
                  ].map(({ label, date, done, accent, active }) => (
                    <li key={label} className="relative flex items-start gap-4">
                      {/* Dot */}
                      <div
                        className={cn(
                          "absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-black shrink-0",
                          active && "status-pulse"
                        )}
                        style={{ backgroundColor: done ? accent : "#222222", boxShadow: done ? `0 0 8px ${accent}40` : "none" }}
                      />
                      <div>
                        <p className="text-sm font-bold text-white uppercase tracking-wide">{label}</p>
                        <p className="mt-0.5 text-xs text-[#555555]">{date}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </motion.section>

            {/* Judging Criteria */}
            {categories && categories.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <SectionHeading>How you&apos;ll be judged</SectionHeading>
                {totalPoints > 0 && (
                  <p className="mb-5 text-xs text-[#555555]">
                    {totalPoints} total points · {categories.length}{" "}
                    {categories.length === 1 ? "category" : "categories"}
                  </p>
                )}
                <div className="space-y-3">
                  {categories.map((cat) => {
                    const pct = totalPoints > 0 ? Math.round((cat.maxScore / totalPoints) * 100) : 0;
                    return (
                      <div key={cat._id} className="border border-[#1F1F1F] bg-[#0A0A0A] p-4">
                        <div className="mb-3 flex items-center justify-between gap-4">
                          <p className="text-sm font-bold text-white uppercase tracking-wide">
                            {cat.name}
                          </p>
                          <span className="shrink-0 rounded-sm border border-[#00FF41]/30 bg-[#00FF4108] px-2 py-0.5 text-xs font-bold tabular-nums text-[#00FF41]">
                            {cat.maxScore} pts
                          </span>
                        </div>
                        {/* Progress bar */}
                        {totalPoints > 0 && (
                          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[#111111]">
                            <div
                              className="h-full rounded-full bg-[#00FF41] transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                        {cat.description && (
                          <p className="text-xs text-[#666666] leading-relaxed whitespace-pre-wrap break-words">
                            {cat.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* Judges */}
            {publicJudges && publicJudges.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
              >
                <SectionHeading>Judges</SectionHeading>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {publicJudges.map((judge) => (
                    <div key={judge._id} className="flex flex-col items-center gap-3 py-5 px-3 border border-[#1F1F1F] bg-[#0A0A0A] text-center">
                      {judge.userImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={judge.userImageUrl}
                          alt={judge.userName}
                          className="h-16 w-16 rounded-full border border-[#1F1F1F] object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#1F1F1F] text-xl font-bold text-[#555555] uppercase">
                          {judge.userName[0] ?? "?"}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wide leading-snug">
                          {judge.userName}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[#555555] uppercase tracking-widest">
                          Judge
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Sponsors */}
            {sponsors && sponsors.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <SectionHeading>Sponsors</SectionHeading>
                <div className="space-y-8">
                  {/* Featured */}
                  {featuredSponsors.length > 0 && (
                    <div className="space-y-4">
                      {featuredSponsors.map((s) => (
                        <div key={s._id} className="group">
                          <MaybeSponsorLink sponsor={s} className="block">
                            {s.bannerUrl ? (
                              <div className="relative overflow-hidden border border-[#1F1F1F] bg-[#111111]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.bannerUrl} alt={`${s.name} banner`} className="h-40 w-full object-cover" />
                                {s.pfpUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={s.pfpUrl} alt={s.name} className="absolute bottom-3 left-4 h-14 w-14 rounded-full border-2 border-black object-cover" />
                                )}
                              </div>
                            ) : s.pfpUrl ? (
                              <div className="flex h-36 items-center justify-center border border-[#1F1F1F] bg-[#111111]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.pfpUrl} alt={s.name} className="h-20 w-20 rounded-full border border-[#1F1F1F] object-cover" />
                              </div>
                            ) : null}
                          </MaybeSponsorLink>
                          <SponsorNameRow sponsor={s} size="lg" />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Large */}
                  {largeSponsors.length > 0 && (
                    <div className="flex flex-wrap gap-5">
                      {largeSponsors.map((s) => (
                        <div key={s._id} className="group w-64 max-w-full min-w-0 overflow-hidden">
                          <MaybeSponsorLink sponsor={s} className="block">
                            {s.bannerUrl ? (
                              <div className="relative overflow-hidden border border-[#1F1F1F] bg-[#111111]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.bannerUrl} alt={`${s.name} banner`} className="h-28 w-full object-cover" />
                                {s.pfpUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={s.pfpUrl} alt={s.name} className="absolute bottom-2 left-2 h-12 w-12 rounded-full border-2 border-black object-cover" />
                                )}
                              </div>
                            ) : s.pfpUrl ? (
                              <div className="flex h-28 items-center justify-center border border-[#1F1F1F] bg-[#111111]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.pfpUrl} alt={s.name} className="h-16 w-16 rounded-full border border-[#1F1F1F] object-cover" />
                              </div>
                            ) : null}
                          </MaybeSponsorLink>
                          <SponsorNameRow sponsor={s} size="md" />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Medium */}
                  {mediumSponsors.length > 0 && (
                    <div className="flex flex-wrap gap-4">
                      {mediumSponsors.map((s) => (
                        <div key={s._id} className="group w-44 max-w-full min-w-0 overflow-hidden">
                          <MaybeSponsorLink sponsor={s} className="block">
                            {s.bannerUrl ? (
                              <div className="relative overflow-hidden border border-[#1F1F1F] bg-[#111111]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.bannerUrl} alt={`${s.name} banner`} className="h-20 w-full object-cover" />
                                {s.pfpUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={s.pfpUrl} alt={s.name} className="absolute bottom-1 left-2 h-8 w-8 rounded-full border-2 border-black object-cover" />
                                )}
                              </div>
                            ) : s.pfpUrl ? (
                              <div className="flex h-20 items-center justify-center border border-[#1F1F1F] bg-[#111111]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.pfpUrl} alt={s.name} className="h-12 w-12 rounded-full border border-[#1F1F1F] object-cover" />
                              </div>
                            ) : null}
                          </MaybeSponsorLink>
                          <SponsorNameRow sponsor={s} size="sm" />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Small */}
                  {smallSponsors.length > 0 && (
                    <div className="flex flex-wrap gap-5 items-center">
                      {smallSponsors.map((s) => (
                        <div key={s._id} className="group flex flex-col items-center gap-2">
                          {s.pfpUrl && (
                            s.websiteUrl && isSafeHttpUrl(s.websiteUrl) ? (
                              <a href={s.websiteUrl} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={s.pfpUrl} alt={s.name} className="h-12 w-12 rounded-full border border-[#1F1F1F] object-cover" />
                              </a>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.pfpUrl} alt={s.name} className="h-12 w-12 rounded-full border border-[#1F1F1F] object-cover" />
                            )
                          )}
                          <SponsorNameRow sponsor={s} size="sm" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.section>
            )}

          </div>{/* end main column */}

          {/* ── Sticky sidebar ───────────────────────────────────────────── */}
          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="w-full shrink-0 lg:sticky lg:top-20 lg:w-72"
          >
            {/* Registration card */}
            <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold text-white uppercase tracking-wider">
                  Registration
                </p>
                <StatusPill status={status} countdown={countdown} compact />
              </div>

              {isPublicRegistrationOpen ? (
                <>
                  <RegisterButton hackathonId={hackathonId} isAuthenticated={isAuthenticated} isJoining={isJoining} onJoin={onJoin} />
                  <p className="mt-2.5 text-center text-[10px] text-[#333333] uppercase tracking-wider">
                    Public · No invite code
                  </p>
                </>
              ) : (
                <p className="py-3 text-center text-xs text-[#555555] uppercase tracking-wider">
                  Public registration is closed.
                </p>
              )}

              <div className="mt-4 border-t border-[#1F1F1F] pt-4 space-y-3">
                <StatRow icon={<Clock className="h-3.5 w-3.5" />} label="Date">
                  {format(new Date(hackathon.startDate), "MMM d, yyyy h:mm a")} –{" "}
                  {format(new Date(hackathon.endDate), "MMM d, yyyy h:mm a")}
                </StatRow>
                {hackathon.submissionsStartDate && hackathon.submissionsStartDate !== hackathon.startDate && (
                  <StatRow icon={<Clock className="h-3.5 w-3.5" />} label="Submissions open">
                    {format(new Date(hackathon.submissionsStartDate), "MMM d, yyyy h:mm a")}
                  </StatRow>
                )}
                {hackathon.submissionsEndDate && hackathon.submissionsEndDate !== hackathon.endDate && (
                  <StatRow icon={<Clock className="h-3.5 w-3.5" />} label="Submissions close">
                    {format(new Date(hackathon.submissionsEndDate), "MMM d, yyyy h:mm a")}
                  </StatRow>
                )}
                {(categories?.length ?? 0) > 0 && (
                  <StatRow icon={<Zap className="h-3.5 w-3.5" />} label="Categories">
                    {categories!.length} judging {categories!.length === 1 ? "category" : "categories"}
                  </StatRow>
                )}
                {(publicJudges?.length ?? 0) > 0 && (
                  <StatRow icon={<Users className="h-3.5 w-3.5" />} label="Judges">
                    {publicJudges!.length} {publicJudges!.length === 1 ? "judge" : "judges"}
                  </StatRow>
                )}
              </div>
            </div>

            {/* Leaderboard link */}
            {hackathon.scoresVisible !== false && hackathon.scoresVisible !== "none" && hackathon.scoresVisible !== "judges" && status !== "upcoming" && (
              <Link
                href={`/hackathon/${hackathonId}/leaderboard`}
                className="group mt-3 flex items-center justify-between border border-[#1F1F1F] bg-[#0A0A0A] px-5 py-4 transition-colors hover:border-[#FF6600]"
              >
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-[#FF6600]" />
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-wide group-hover:text-[#FF6600] transition-colors">
                      Leaderboard
                    </p>
                    <p className="text-[10px] text-[#555555]">Live rankings &amp; scores</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#333333] group-hover:text-[#FF6600] transition-colors" />
              </Link>
            )}

            {/* Already have an account? */}
            <div className="mt-3 border border-[#1F1F1F] bg-[#0A0A0A] px-5 py-4">
              <p className="text-[10px] text-[#555555] uppercase tracking-wider">
                Already a member?
              </p>
              <SignInButton mode="redirect" forceRedirectUrl={`/hackathon/${hackathonId}`}>
                <button className="mt-2 text-xs text-white uppercase tracking-wider hover:text-[#00FF41] transition-colors">
                  Sign in to your dashboard →
                </button>
              </SignInButton>
            </div>
          </motion.aside>

        </div>{/* end 2-col layout */}
      </div>{/* end body */}

      {/* ── Bottom CTA bar (mobile-first, for when sidebar is off-screen) ── */}
      {isPublicRegistrationOpen && (
        <div className="sticky bottom-0 z-40 border-t border-[#1F1F1F] bg-black/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <RegisterButton hackathonId={hackathonId} isAuthenticated={isAuthenticated} isJoining={isJoining} onJoin={onJoin} />
        </div>
      )}

    </div>
  );
}

// ─── Small reusable sub-components ───────────────────────────────────────────

function StatusPill({ status, countdown, compact }: { status: EventStatus; countdown: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-bold uppercase tracking-widest",
        compact ? "text-[9px]" : "border px-3 py-1 text-[10px]",
        status === "live" && !compact && "public-live-status-pill",
        status === "live"
          ? compact ? "text-[#00FF41]" : "border-[#00FF41]/30 bg-[#00FF4110] text-[#00FF41]"
          : status === "upcoming"
          ? compact ? "text-[#00B4FF]" : "border-[#00B4FF]/30 bg-[#00B4FF10] text-[#00B4FF]"
          : compact ? "text-[#555555]" : "border-[#555555]/30 text-[#555555]"
      )}
    >
      {status === "live" && <span className="status-pulse h-1.5 w-1.5 rounded-full bg-[#00FF41] inline-block" />}
      {countdown}
    </span>
  );
}

function StatRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="mt-0.5 shrink-0 text-[#555555]">{icon}</span>
      <div>
        <span className="text-[#555555] uppercase tracking-wider">{label}: </span>
        <span className="text-[#AAAAAA]">{children}</span>
      </div>
    </div>
  );
}

function SponsorNameRow({ sponsor, size }: { sponsor: PublicSponsor; size: "lg" | "md" | "sm" }) {
  const textClass = size === "lg" ? "text-base font-bold" : size === "md" ? "text-sm font-bold" : "text-xs font-bold";
  const nameEl = (
    <span className={cn("flex items-center gap-1 text-white uppercase tracking-wide group-hover:text-[#00B4FF] transition-colors", textClass)}>
      {sponsor.name}
      {sponsor.badgeText && (
        <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">{sponsor.badgeText}</span>
      )}
      {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) && (
        <ExternalLink className="h-3 w-3 opacity-50" />
      )}
    </span>
  );
  // Render as a non-interactive div — the MaybeSponsorLink above the image
  // already provides the accessible link; duplicating as another <a> would
  // create redundant tab stops for screen readers.
  return <div className="mt-2">{nameEl}</div>;
}
