"use client";

import { useState } from "react";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useDisplayNamePrompt } from "@/components/display-name-prompt";

interface JoinHackathonDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinHackathonDialog({ isOpen, onClose }: JoinHackathonDialogProps) {
  const router = useRouter();
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const joinHackathon = useMutation(api.hackathons.join);

  const [joinCode, setJoinCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestDisplayName, displayNamePrompt } = useDisplayNamePrompt();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      toast.error("Please enter a join code");
      return;
    }
    if (!isAuthenticated) {
      toast.error("Please sign in first");
      return;
    }
    const userName = await requestDisplayName(user, { confirm: true });
    if (!userName) {
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await joinHackathon({
        joinCode: joinCode.trim(),
        userName,
        userImageUrl: user?.imageUrl,
      });
      if (result.alreadyMember) {
        toast.info("You're already a member — redirecting to hackathon.");
      } else {
        toast.success("Successfully joined the hackathon!");
      }
      setJoinCode("");
      onClose();
      router.push(`/hackathon/${result.hackathonId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join hackathon";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/80" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md border border-[#1F1F1F] bg-black p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between border-b border-[#1F1F1F] pb-4">
          <div>
            <div className="text-xs text-[#555555] uppercase tracking-widest mb-1">── JOIN EVENT</div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wide">JOIN HACKATHON</h2>
          </div>
          <button onClick={onClose} className="p-1 text-[#555555] hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
              JOIN CODE:
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#555555]">&gt;</span>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.slice(0, 6))}
                placeholder="XXXXXX"
                maxLength={6}
                className="tui-input pl-8 text-center text-lg tracking-widest text-[#00FF41] font-bold placeholder-[#333333]"
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-[#333333] text-center">
              Your role will be assigned based on the join code provided by the organizer.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#1F1F1F]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider hover:border-white hover:text-white transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting || joinCode.length < 1 || !isAuthenticated}
              className="px-4 py-2 text-xs font-bold text-black bg-[#00B4FF] uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "JOINING..." : "[ JOIN HACKATHON ]"}
            </button>
          </div>
        </form>
        </div>
      </div>
      {displayNamePrompt}
    </>
  );
}
