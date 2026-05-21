"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { CreateHackathonDialog } from "@/components/create-hackathon-dialog";
import { JoinHackathonDialog } from "@/components/join-hackathon-dialog";

const roleBadgeClass = (role: string) => {
  switch (role) {
    case "organizer":
      return "border-[#FF6600] text-[#FF6600]";
    case "judge":
      return "border-[#00B4FF] text-[#00B4FF]";
    case "competitor":
      return "border-[#00FF41] text-[#00FF41]";
    default:
      return "border-[#555555] text-[#555555]";
  }
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const hackathons = useQuery(api.hackathons.listMine);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-xs text-[#555555] uppercase tracking-widest">
          <span className="cursor-blink">▓▓▓░░░</span> LOADING...
        </div>
      </div>
    );
  }

  const validHackathons = (hackathons ?? []).filter(
    (h): h is NonNullable<typeof h> => h !== null
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 border-b border-[#1F1F1F] pb-6">
        <div className="text-xs text-[#555555] uppercase tracking-widest mb-1">
          ~/hillpost/dashboard
        </div>
        <h1 className="text-2xl font-bold text-white uppercase tracking-wide">
          HELLO, {user?.firstName?.toUpperCase() || user?.username?.toUpperCase() || "USER"}
          <span className="cursor-blink ml-2">▊</span>
        </h1>
        <p className="mt-1 text-xs text-[#555555] uppercase tracking-wider">
          Manage your hackathons and competitions
        </p>
      </div>

      {/* Action buttons */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() => setShowCreateDialog(true)}
          className="group flex items-center gap-4 border border-[#1F1F1F] bg-[#0A0A0A] p-5 text-left transition-colors hover:border-[#FF6600]"
        >
          <div className="text-2xl font-bold text-[#1F1F1F] group-hover:text-[#FF6600] transition-colors">
            [ + ]
          </div>
          <div>
            <p className="text-sm font-bold text-white uppercase tracking-wide group-hover:text-[#FF6600] transition-colors">
              CREATE HACKATHON
            </p>
            <p className="text-xs text-[#555555]">
              Organize a new competition
            </p>
          </div>
        </button>

        <button
          onClick={() => setShowJoinDialog(true)}
          className="group flex items-center gap-4 border border-[#1F1F1F] bg-[#0A0A0A] p-5 text-left transition-colors hover:border-[#00B4FF]"
        >
          <div className="text-2xl font-bold text-[#1F1F1F] group-hover:text-[#00B4FF] transition-colors">
            [ → ]
          </div>
          <div>
            <p className="text-sm font-bold text-white uppercase tracking-wide group-hover:text-[#00B4FF] transition-colors">
              JOIN HACKATHON
            </p>
            <p className="text-xs text-[#555555]">
              Enter with a join code
            </p>
          </div>
        </button>
      </div>

      {/* My Hackathons */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-[#555555] uppercase tracking-widest">── MY HACKATHONS</span>
          <div className="h-px flex-1 bg-[#1F1F1F]" />
        </div>

        {hackathons === undefined ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-24 border border-[#1F1F1F] bg-[#0A0A0A]"
              >
                <div className="h-full flex items-center px-5">
                  <div className="text-xs text-[#333333] uppercase tracking-widest cursor-blink">
                    ░░░░░░░░░░░░░░░░
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : validHackathons.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-[#1F1F1F] bg-[#0A0A0A] py-16">
            <div className="mb-4 text-4xl text-[#1F1F1F] font-bold">[ ]</div>
            <h3 className="text-sm font-bold text-[#555555] uppercase tracking-wider">
              NO EVENTS FOUND
            </h3>
            <p className="mt-1 text-xs text-[#333333] uppercase tracking-wide">
              Create or join a hackathon to get started
            </p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
            }}
          >
            {validHackathons.map((h) => {
              const isUpcoming = now < h.startDate;
              const isLive = now >= h.startDate && now <= h.endDate;
              return (
                <motion.button
                  key={h._id}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  onClick={() => router.push(`/hackathon/${h._id}`)}
                  className="group border border-[#1F1F1F] bg-[#0A0A0A] p-5 text-left transition-colors hover:border-white"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide group-hover:text-[#00FF41] transition-colors">
                      {h.name}
                    </h3>
                    <span
                      className={cn(
                        "tui-badge",
                        roleBadgeClass(h.myRole)
                      )}
                    >
                      {h.myRole.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#555555]">
                    <span>
                      {format(new Date(h.startDate), "MMM d")} —{" "}
                      {format(new Date(h.endDate), "MMM d, yyyy")}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {isLive ? (
                      <span className="flex items-center gap-1 text-xs text-[#00FF41] uppercase tracking-widest">
                        <span className="status-pulse h-1.5 w-1.5 bg-[#00FF41] inline-block" />
                        [LIVE]
                      </span>
                    ) : isUpcoming ? (
                      <span className="flex items-center gap-1 text-xs text-[#00B4FF] uppercase tracking-widest">
                        <span className="h-1.5 w-1.5 bg-[#00B4FF] inline-block" />
                        [UPCOMING]
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-[#555555] uppercase tracking-widest">
                        <span className="h-1.5 w-1.5 bg-[#555555] inline-block" />
                        [CLOSED]
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>

      <CreateHackathonDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
      <JoinHackathonDialog
        isOpen={showJoinDialog}
        onClose={() => setShowJoinDialog(false)}
      />
    </div>
  );
}
