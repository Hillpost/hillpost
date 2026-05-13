"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useDisplayNamePrompt } from "@/components/display-name-prompt";

export default function JoinByLinkPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const joinCode = params.code as string;

  const hackathon = useQuery(api.hackathons.getByJoinCode, { joinCode });
  const membership = useQuery(
    api.members.getMyMembership,
    hackathon?._id ? { hackathonId: hackathon._id } : "skip"
  );
  const joinHackathon = useMutation(api.hackathons.join);

  const [isJoining, setIsJoining] = useState(false);
  const { requestDisplayName, displayNamePrompt } = useDisplayNamePrompt();

  const isMembershipLoading =
    hackathon !== undefined && hackathon !== null && isAuthenticated && membership === undefined;

  const role = hackathon?.role ?? "competitor";
  const isCompetitorCode = role === "competitor";

  if (hackathon === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-xs text-[#555555] uppercase tracking-widest cursor-blink">
          ▓▓▓░░░ LOOKING UP HACKATHON...
        </div>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="border border-red-500/30 bg-[#0A0A0A] p-8 text-center">
          <div className="mb-4 text-2xl font-bold text-red-400">[✗ INVALID CODE]</div>
          <p className="text-sm font-bold text-white uppercase tracking-wide mb-2">
            Invalid Join Link
          </p>
          <p className="text-xs text-[#555555] mb-6">
            This join link is not valid. Please check with the organizer for the correct link.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const handleJoin = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in first");
      return;
    }
    const userName = await requestDisplayName(user, { confirm: true });
    if (!userName) {
      return;
    }
    setIsJoining(true);
    try {
      const result = await joinHackathon({
        joinCode,
        userName,
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
      setIsJoining(false);
    }
  };

  if (membership && hackathon) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="border border-[#00FF41]/30 bg-[#0A0A0A] p-8">
          <div className="mb-6 text-center">
            <div className="mb-4 text-2xl font-bold text-[#00FF41]">[✓ ALREADY IN]</div>
            <h1 className="text-lg font-bold text-white uppercase tracking-wide">
              You&apos;re already a member
            </h1>
            <p className="mt-2 text-xs text-[#555555]">
              You&apos;re already a member of{" "}
              <span className="font-bold text-white">{hackathon.name}</span>.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href={`/hackathon/${hackathon._id}`}
              className="flex w-full items-center justify-center gap-2 border border-[#00FF41] py-2.5 text-xs font-bold text-[#00FF41] uppercase tracking-wider hover:bg-[#00FF41] hover:text-black transition-colors"
            >
              GO TO HACKATHON
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/dashboard"
              className="text-center text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors"
            >
              Go to Dashboard instead
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-8">
        <div className="mb-6">
          <div className="mb-2 text-xs text-[#555555] uppercase tracking-widest">
            JOINING EVENT: {joinCode.toUpperCase()}
          </div>
          <h1 className="text-xl font-bold text-white uppercase tracking-wide">
            {hackathon.name}
          </h1>
        </div>

        <div className="mb-6 space-y-3 border-t border-[#1F1F1F] pt-4">
          <div className="flex items-center gap-2 text-xs text-[#555555]">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {format(new Date(hackathon.startDate), "MMM d, yyyy")} —{" "}
              {format(new Date(hackathon.endDate), "MMM d, yyyy")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#555555]">YOU WILL JOIN AS:</span>
            <span className={cn(
              "tui-badge",
              isCompetitorCode ? "border-[#00FF41] text-[#00FF41]" : "border-[#00B4FF] text-[#00B4FF]"
            )}>
              {role.toUpperCase()}
            </span>
          </div>

          {!isCompetitorCode && (
            <p className="border border-[#00B4FF]/20 bg-[#00B4FF08] px-3 py-2 text-xs text-[#00B4FF]">
              Judge access requires organizer approval after joining.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleJoin}
            disabled={isJoining || !!isMembershipLoading}
            className={cn(
              "flex w-full items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50",
              isCompetitorCode
                ? "border border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black"
                : "border border-[#00B4FF] text-[#00B4FF] hover:bg-[#00B4FF] hover:text-black"
            )}
          >
            {isJoining ? "JOINING..." : "[ CONFIRM JOIN → ]"}
          </button>
          <Link
            href="/dashboard"
            className="text-center text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors"
          >
            Go to Dashboard instead
          </Link>
        </div>
        </div>
      </div>
      {displayNamePrompt}
    </>
  );
}
