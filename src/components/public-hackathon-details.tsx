"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { isSafeHttpUrl } from "@/lib/url";

export type PublicCategory = {
  _id: Id<"categories">;
  name: string;
  description: string;
  maxScore: number;
};

export type PublicSponsor = {
  _id: Id<"sponsors">;
  name: string;
  pfpUrl?: string;
  bannerUrl?: string;
  websiteUrl?: string;
  badgeText?: string;
  displayStyle?: "featured" | "large" | "medium" | "small";
};

export type PublicJudge = {
  _id: Id<"hackathonMembers">;
  userName: string;
  userImageUrl?: string;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#555555]">
      {children}
    </h2>
  );
}

export function PublicCategoriesSection({
  categories,
  showHeading = true,
}: {
  categories: PublicCategory[] | undefined;
  showHeading?: boolean;
}) {
  if (!categories?.length) return null;

  const totalPoints = categories.reduce((sum, category) => sum + category.maxScore, 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {showHeading && <SectionHeading>How you&apos;ll be judged</SectionHeading>}
      {totalPoints > 0 && (
        <p className="mb-5 text-xs text-[#555555]">
          {totalPoints} total points · {categories.length}{" "}
          {categories.length === 1 ? "category" : "categories"}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category, index) => {
          const isLastOddCategory =
            categories.length % 2 === 1 && index === categories.length - 1;

          return (
            <div
              key={category._id}
              className={cn(
                "h-full border border-[#1F1F1F] bg-[#0A0A0A] p-4",
                isLastOddCategory && "sm:col-span-2 xl:col-span-1",
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-sm font-bold uppercase tracking-wide text-white">
                  {category.name}
                </p>
                <span className="shrink-0 rounded-sm border border-[#00FF41]/30 bg-[#00FF4108] px-2 py-0.5 text-xs font-bold tabular-nums text-[#00FF41]">
                  {category.maxScore} pts
                </span>
              </div>
              {category.description && (
                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#666666]">
                  {category.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

export function PublicJudgesSection({
  judges,
}: {
  judges: PublicJudge[] | undefined;
}) {
  if (!judges?.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
    >
      <SectionHeading>Judges</SectionHeading>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {judges.map((judge) => (
          <div
            key={judge._id}
            className="flex flex-col items-center gap-3 border border-[#1F1F1F] bg-[#0A0A0A] px-3 py-5 text-center"
          >
            {judge.userImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={judge.userImageUrl}
                alt={judge.userName}
                className="h-16 w-16 rounded-full border border-[#1F1F1F] object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#1F1F1F] text-xl font-bold uppercase text-[#555555]">
                {judge.userName[0] ?? "?"}
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase leading-snug tracking-wide text-white">
                {judge.userName}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[#555555]">
                Judge
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

export function PublicSponsorsSection({
  sponsors,
  showHeading = true,
}: {
  sponsors: PublicSponsor[] | undefined;
  showHeading?: boolean;
}) {
  if (!sponsors?.length) return null;

  const featuredSponsors = sponsors.filter(
    (sponsor) => (sponsor.displayStyle ?? "medium") === "featured",
  );
  const largeSponsors = sponsors.filter(
    (sponsor) => (sponsor.displayStyle ?? "medium") === "large",
  );
  const mediumSponsors = sponsors.filter(
    (sponsor) => (sponsor.displayStyle ?? "medium") === "medium",
  );
  const smallSponsors = sponsors.filter(
    (sponsor) => (sponsor.displayStyle ?? "medium") === "small",
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      {showHeading && <SectionHeading>Sponsors</SectionHeading>}
      <div className="space-y-8">
        {featuredSponsors.length > 0 && (
          <div className="space-y-4">
            {featuredSponsors.map((sponsor) => (
              <div key={sponsor._id} className="group">
                <MaybeSponsorLink sponsor={sponsor} className="block">
                  {sponsor.bannerUrl ? (
                    <div className="relative overflow-hidden border border-[#1F1F1F] bg-[#111111]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sponsor.bannerUrl}
                        alt={`${sponsor.name} banner`}
                        className="h-40 w-full object-cover"
                      />
                      {sponsor.pfpUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sponsor.pfpUrl}
                          alt={sponsor.name}
                          className="absolute bottom-3 left-4 h-14 w-14 rounded-full border-2 border-black object-cover"
                        />
                      )}
                    </div>
                  ) : sponsor.pfpUrl ? (
                    <SponsorAvatar sponsor={sponsor} size="featured" />
                  ) : null}
                </MaybeSponsorLink>
                <SponsorNameRow sponsor={sponsor} size="lg" />
              </div>
            ))}
          </div>
        )}

        {largeSponsors.length > 0 && (
          <div className="flex flex-wrap gap-5">
            {largeSponsors.map((sponsor) => (
              <div
                key={sponsor._id}
                className="group w-64 max-w-full min-w-0 overflow-hidden"
              >
                <MaybeSponsorLink sponsor={sponsor} className="block">
                  {sponsor.bannerUrl ? (
                    <SponsorBanner sponsor={sponsor} size="large" />
                  ) : sponsor.pfpUrl ? (
                    <SponsorAvatar sponsor={sponsor} size="large" />
                  ) : null}
                </MaybeSponsorLink>
                <SponsorNameRow sponsor={sponsor} size="md" />
              </div>
            ))}
          </div>
        )}

        {mediumSponsors.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {mediumSponsors.map((sponsor) => (
              <div
                key={sponsor._id}
                className="group w-44 max-w-full min-w-0 overflow-hidden"
              >
                <MaybeSponsorLink sponsor={sponsor} className="block">
                  {sponsor.bannerUrl ? (
                    <SponsorBanner sponsor={sponsor} size="medium" />
                  ) : sponsor.pfpUrl ? (
                    <SponsorAvatar sponsor={sponsor} size="medium" />
                  ) : null}
                </MaybeSponsorLink>
                <SponsorNameRow sponsor={sponsor} size="sm" />
              </div>
            ))}
          </div>
        )}

        {smallSponsors.length > 0 && (
          <div className="flex flex-wrap items-center gap-5">
            {smallSponsors.map((sponsor) => (
              <div
                key={sponsor._id}
                className="group flex flex-col items-center gap-2"
              >
                {sponsor.pfpUrl && (
                  <MaybeSponsorLink sponsor={sponsor}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sponsor.pfpUrl}
                      alt={sponsor.name}
                      className="h-12 w-12 rounded-full border border-[#1F1F1F] object-cover"
                    />
                  </MaybeSponsorLink>
                )}
                <SponsorNameRow sponsor={sponsor} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}

function MaybeSponsorLink({
  sponsor,
  children,
  className,
}: {
  sponsor: PublicSponsor;
  children: React.ReactNode;
  className?: string;
}) {
  if (sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl)) {
    return (
      <a
        href={sponsor.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={`${sponsor.name} website`}
      >
        {children}
      </a>
    );
  }

  return <div className={className}>{children}</div>;
}

function SponsorBanner({
  sponsor,
  size,
}: {
  sponsor: PublicSponsor;
  size: "large" | "medium";
}) {
  if (!sponsor.bannerUrl) return null;

  const isLarge = size === "large";
  return (
    <div className="relative overflow-hidden border border-[#1F1F1F] bg-[#111111]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sponsor.bannerUrl}
        alt={`${sponsor.name} banner`}
        className={isLarge ? "h-28 w-full object-cover" : "h-20 w-full object-cover"}
      />
      {sponsor.pfpUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sponsor.pfpUrl}
          alt={sponsor.name}
          className={
            isLarge
              ? "absolute bottom-2 left-2 h-12 w-12 rounded-full border-2 border-black object-cover"
              : "absolute bottom-1 left-2 h-8 w-8 rounded-full border-2 border-black object-cover"
          }
        />
      )}
    </div>
  );
}

function SponsorAvatar({
  sponsor,
  size,
}: {
  sponsor: PublicSponsor;
  size: "featured" | "large" | "medium";
}) {
  if (!sponsor.pfpUrl) return null;

  const classes = {
    featured: { container: "h-36", image: "h-20 w-20" },
    large: { container: "h-28", image: "h-16 w-16" },
    medium: { container: "h-20", image: "h-12 w-12" },
  }[size];

  return (
    <div
      className={cn(
        "flex items-center justify-center border border-[#1F1F1F] bg-[#111111]",
        classes.container,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sponsor.pfpUrl}
        alt={sponsor.name}
        className={cn(
          "rounded-full border border-[#1F1F1F] object-cover",
          classes.image,
        )}
      />
    </div>
  );
}

function SponsorNameRow({
  sponsor,
  size,
}: {
  sponsor: PublicSponsor;
  size: "lg" | "md" | "sm";
}) {
  const textClass =
    size === "lg"
      ? "text-base font-bold"
      : size === "md"
        ? "text-sm font-bold"
        : "text-xs font-bold";

  return (
    <div className="mt-2">
      <span
        className={cn(
          "flex items-center gap-1 uppercase tracking-wide text-white transition-colors group-hover:text-[#00B4FF]",
          textClass,
        )}
      >
        {sponsor.name}
        {sponsor.badgeText && (
          <span className="tui-badge border-[#00B4FF] text-[#00B4FF]">
            {sponsor.badgeText}
          </span>
        )}
        {sponsor.websiteUrl && isSafeHttpUrl(sponsor.websiteUrl) && (
          <ExternalLink className="h-3 w-3 opacity-50" />
        )}
      </span>
    </div>
  );
}
