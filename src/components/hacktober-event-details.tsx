"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  PublicCategoriesSection,
  PublicJudgesSection,
  PublicSponsorsSection,
} from "@/components/public-hackathon-details";

export function HacktoberEventDetails({
  hackathonId,
}: {
  hackathonId: Id<"hackathons">;
}) {
  const categories = useQuery(api.categories.list, { hackathonId });
  const sponsors = useQuery(api.sponsors.list, { hackathonId });
  const judges = useQuery(api.members.listPublicJudges, { hackathonId });

  const isLoading =
    categories === undefined || sponsors === undefined || judges === undefined;
  const hasDetails =
    (categories?.length ?? 0) > 0 ||
    (sponsors?.length ?? 0) > 0 ||
    (judges?.length ?? 0) > 0;

  if (!isLoading && !hasDetails) return null;

  if (isLoading) {
    return (
      <section className="border-b border-[#1F1F1F] bg-black px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2">
          <div className="h-36 animate-pulse border border-[#1F1F1F] bg-[#0A0A0A]" />
          <div className="h-36 animate-pulse border border-[#1F1F1F] bg-[#0A0A0A]" />
        </div>
      </section>
    );
  }

  const hasCriteria = (categories?.length ?? 0) > 0 || (judges?.length ?? 0) > 0;

  return (
    <>
      {hasCriteria && (
        <section className="border-b border-[#1F1F1F] bg-black px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12">
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[#FF6600]">
                03 / Judging criteria
              </p>
              <h2 className="text-3xl font-bold uppercase sm:text-4xl">
                How you&apos;ll be judged.
              </h2>
            </div>

            <div className="space-y-16">
              <PublicCategoriesSection
                categories={categories}
                showHeading={false}
              />
              <PublicJudgesSection judges={judges} />
            </div>
          </div>
        </section>
      )}

      {(sponsors?.length ?? 0) > 0 && (
        <section className="border-b border-[#1F1F1F] bg-[#0A0A0A] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12">
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[#FF6600]">
                04 / Sponsors
              </p>
              <h2 className="text-3xl font-bold uppercase sm:text-4xl">
                Thank you to our sponsors.
              </h2>
            </div>

            <PublicSponsorsSection sponsors={sponsors} showHeading={false} />
          </div>
        </section>
      )}
    </>
  );
}
