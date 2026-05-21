"use client";

import { useState } from "react";
import { useMutation, useConvexAuth } from "convex/react";

import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { X, Lock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSafeHttpUrl } from "@/lib/url";
import { useDisplayNamePrompt } from "@/components/display-name-prompt";
import { formatDateForInput, parseDateInputToTimestamp } from "@/lib/date-input";

interface CreateHackathonDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateHackathonDialog({ isOpen, onClose }: CreateHackathonDialogProps) {
  const router = useRouter();
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const createHackathon = useMutation(api.hackathons.create);

  const today = formatDateForInput(new Date());

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [submissionsStartDate, setSubmissionsStartDate] = useState("");
  const [endDate, setEndDate] = useState(today);
  const [submissionFrequency, setSubmissionFrequency] = useState(60);
  const [isPublic, setIsPublic] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestDisplayName, displayNamePrompt } = useDisplayNamePrompt();

  const resetForm = () => {
    setName("");
    setDescription("");
    setStartDate(today);
    setSubmissionsStartDate("");
    setEndDate(today);
    setSubmissionFrequency(60);
    setIsPublic(false);
    setBannerImageUrl("");
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !startDate || !endDate) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!isAuthenticated) {
      toast.error("Please sign in first");
      return;
    }
    const trimmedBanner = bannerImageUrl.trim();
    if (trimmedBanner && !isSafeHttpUrl(trimmedBanner)) {
      toast.error("Banner image URL must be a valid http(s) URL");
      return;
    }
    if (submissionsStartDate) {
      const subStart = parseDateInputToTimestamp(submissionsStartDate);
      const end = parseDateInputToTimestamp(endDate);
      if (subStart > end) {
        toast.error("Submissions cannot open after the hackathon ends");
        return;
      }
    }
    const userName = await requestDisplayName(user);
    if (!userName) {
      return;
    }
    setIsSubmitting(true);
    try {
      const hackathonId = await createHackathon({
        name,
        description,
        startDate: parseDateInputToTimestamp(startDate),
        submissionsStartDate: submissionsStartDate ? parseDateInputToTimestamp(submissionsStartDate) : undefined,
        endDate: parseDateInputToTimestamp(endDate),
        submissionFrequencyMinutes: submissionFrequency,
        openGraphImageUrl: trimmedBanner || undefined,
        isPublic,
        userName,
        userImageUrl: user?.imageUrl,
      });
      toast.success("Hackathon created successfully!");
      resetForm();
      onClose();
      router.push(`/hackathon/${hackathonId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create hackathon");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/80" onClick={onClose} />
        <div className="relative z-10 w-full max-w-lg border border-[#1F1F1F] bg-black p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between border-b border-[#1F1F1F] pb-4">
          <div>
            <div className="text-xs text-[#555555] uppercase tracking-widest mb-1">── NEW EVENT</div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wide">CREATE HACKATHON</h2>
          </div>
          <button onClick={onClose} className="p-1 text-[#555555] hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
              NAME: <span className="text-[#FF6600]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Hackathon"
              className="tui-input"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
              DESCRIPTION: <span className="text-[#FF6600]">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your hackathon..."
              rows={3}
              className="tui-input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
                START DATE: <span className="text-[#FF6600]">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="tui-input"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
                END DATE: <span className="text-[#FF6600]">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="tui-input"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
              SUBMISSIONS OPEN DATE:
            </label>
            <input
              type="date"
              value={submissionsStartDate}
              onChange={(e) => setSubmissionsStartDate(e.target.value)}
              className="tui-input"
            />
            <p className="mt-1 text-xs text-[#333333]">
              When competitors can start submitting. Defaults to the start date if left blank.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
              SUBMISSION COOLDOWN (MINUTES):
            </label>
            <input
              type="number"
              value={submissionFrequency}
              onChange={(e) => setSubmissionFrequency(Number(e.target.value))}
              min={1}
              className="tui-input"
            />
            <p className="mt-1 text-xs text-[#333333]">
              Minimum time between submissions per team
            </p>
          </div>

          <div className="border-t border-[#1F1F1F] pt-4 space-y-3">
            <label className="block text-xs font-bold text-[#555555] uppercase tracking-widest">
              EVENT VISIBILITY:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={cn(
                  "flex flex-col items-start gap-2 border p-3 text-left transition-colors",
                  !isPublic
                    ? "border-[#FF6600] bg-[#FF6600]/5 text-[#FF6600]"
                    : "border-[#1F1F1F] text-[#555555] hover:border-[#555555]"
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest">
                  <Lock className="h-3.5 w-3.5" />
                  PRIVATE
                </div>
                <p className="text-[10px] leading-tight text-current opacity-70">
                  Invite-only via join code. Not listed publicly.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={cn(
                  "flex flex-col items-start gap-2 border p-3 text-left transition-colors",
                  isPublic
                    ? "border-[#00FF41] bg-[#00FF41]/5 text-[#00FF41]"
                    : "border-[#1F1F1F] text-[#555555] hover:border-[#555555]"
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest">
                  <Globe className="h-3.5 w-3.5" />
                  PUBLIC
                </div>
                <p className="text-[10px] leading-tight text-current opacity-70">
                  Listed on discover page with open registration.
                </p>
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
                BANNER IMAGE URL (OPTIONAL):
              </label>
              <input
                type="url"
                value={bannerImageUrl}
                onChange={(e) => setBannerImageUrl(e.target.value)}
                placeholder="https://..."
                className="tui-input"
              />
            </div>
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
              disabled={isSubmitting || !isAuthenticated}
              className="px-4 py-2 text-xs font-bold text-black bg-[#FF6600] uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "CREATING..." : "[ CREATE HACKATHON ]"}
            </button>
          </div>
        </form>
        </div>
      </div>
      {displayNamePrompt}
    </>
  );
}
