"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { format } from "date-fns";
import { Calendar, ArrowRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

function getEventStatus(startDate: number, now: number) {
  if (now < startDate) return "upcoming" as const;
  return "active" as const;
}

export default function DiscoverPage() {
  const publicHackathons = useQuery(api.hackathons.listPublic, {});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 border-b border-[#1F1F1F] pb-6">
        <div className="text-xs text-[#555555] uppercase tracking-widest mb-1">~/discover</div>
        <h1 className="text-2xl font-bold text-white uppercase tracking-wide">PUBLIC HACKATHONS</h1>
        <p className="mt-1 text-xs text-[#555555] uppercase tracking-wider">
          Browse open events and join instantly — no invite code required
        </p>
      </div>

      {publicHackathons === undefined ? (
        <div className="text-xs text-[#555555] uppercase tracking-widest">▓▓▓░░░ LOADING PUBLIC EVENTS...</div>
      ) : publicHackathons.length === 0 ? (
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8 text-center">
          <Globe className="mx-auto mb-3 h-8 w-8 text-[#333333]" />
          <p className="text-sm font-bold text-[#555555] uppercase tracking-wide">NO PUBLIC EVENTS LISTED</p>
          <p className="mt-1 text-xs text-[#333333]">There are no active or upcoming public events right now. Check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {publicHackathons.map((hackathon) => {
            const status = getEventStatus(hackathon.startDate, now);
            return (
              <Link
                key={hackathon._id}
                href={`/hackathon/${hackathon._id}`}
                className="group flex flex-col border border-[#1F1F1F] bg-[#0A0A0A] transition-colors hover:border-[#00FF41]"
              >
                {hackathon.openGraphImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hackathon.openGraphImageUrl}
                    alt={`${hackathon.name} banner`}
                    className="h-32 w-full border-b border-[#1F1F1F] object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-full items-center border-b border-[#1F1F1F] bg-[#0D0D0D] px-4">
                    <Globe className="h-4 w-4 text-[#333333]" />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "tui-badge",
                        status === "active" && "border-[#00FF41] text-[#00FF41]",
                        status === "upcoming" && "border-[#00B4FF] text-[#00B4FF]"
                      )}
                    >
                      {status === "active" && (
                        <span className="mr-1 inline-block h-1.5 w-1.5 bg-[#00FF41] status-pulse" />
                      )}
                      {status.toUpperCase()}
                    </span>
                    <span className="tui-badge border-[#1F1F1F] text-[#555555]">
                      <Globe className="inline h-2.5 w-2.5 mr-1" />
                      PUBLIC
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide group-hover:text-[#00FF41] transition-colors">
                    {hackathon.name}
                  </h2>
                  <p className="line-clamp-2 text-xs text-[#555555] flex-1">{hackathon.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-[#555555]">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {format(new Date(hackathon.startDate), "MMM d")} — {format(new Date(hackathon.endDate), "MMM d, yyyy")}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00FF41] uppercase tracking-wider group-hover:gap-2 transition-all">
                      JOIN <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
