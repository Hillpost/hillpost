"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getClerkDisplayName } from "@/lib/clerk-user";
import {
  serializeRegistrationAnswers,
  validateRegistrationAnswers,
  type RegistrationAnswerState,
} from "@/lib/registration";
import { RegistrationFieldsForm } from "@/components/registration-fields-form";

interface HacktoberRegisterButtonProps {
  hackathonId: Id<"hackathons">;
}

const buttonClassName =
  "inline-flex items-center justify-center border border-[#FF6600] bg-[#FF6600] px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:border-white hover:bg-white disabled:cursor-not-allowed disabled:opacity-50";

export function HacktoberRegisterButton({
  hackathonId,
}: HacktoberRegisterButtonProps) {
  const router = useRouter();
  const { user } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const hackathon = useQuery(api.hackathons.get, { hackathonId });
  const membership = useQuery(api.members.getMyMembership, { hackathonId });
  const joinPublic = useMutation(api.hackathons.joinPublic);
  const [isOpen, setIsOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [displayName, setDisplayName] = useState<string>();
  const [registrationAnswers, setRegistrationAnswers] =
    useState<RegistrationAnswerState>({});
  const resolvedDisplayName = displayName ?? getClerkDisplayName(user) ?? "";
  const buttonLabel = membership ? "[ Open Hackathon ]" : "[ Register ]";

  const openRegistration = () => {
    if (membership) {
      router.push(`/hackathon/${hackathonId}`);
      return;
    }

    setIsOpen(true);
  };

  const closeRegistration = () => {
    if (!isJoining) setIsOpen(false);
  };

  const submitRegistration = async () => {
    if (!isAuthenticated || !hackathon) return;

    const userName = resolvedDisplayName.trim();
    if (!userName) {
      toast.error("Please enter your name");
      return;
    }

    const registrationFields = hackathon.registrationFields ?? [];
    const registrationError = validateRegistrationAnswers(
      registrationFields,
      registrationAnswers,
    );
    if (registrationError) {
      toast.error(registrationError);
      return;
    }

    setIsJoining(true);
    try {
      const result = await joinPublic({
        hackathonId,
        userName,
        userImageUrl: user?.imageUrl,
        registrationAnswers: serializeRegistrationAnswers(
          registrationFields,
          registrationAnswers,
        ),
      });

      if (!result.alreadyMember) {
        toast.success("Successfully registered for Hacktober!");
      }
      setIsOpen(false);
      router.push(`/hackathon/${result.hackathonId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to register for Hacktober",
      );
    } finally {
      setIsJoining(false);
    }
  };

  const button = (
    <button
      type="button"
      onClick={isAuthenticated ? openRegistration : undefined}
      disabled={
        isLoading ||
        !hackathon ||
        (isAuthenticated && membership === undefined)
      }
      className={buttonClassName}
    >
      {buttonLabel}
    </button>
  );

  return (
    <>
      {isAuthenticated ? (
        button
      ) : (
        <SignInButton mode="redirect" forceRedirectUrl="/hacktober">
          {button}
        </SignInButton>
      )}

      {isOpen && hackathon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/80"
            onClick={closeRegistration}
            aria-label="Close registration form"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hacktober-registration-title"
            className="relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto border border-[#1F1F1F] bg-[#0A0A0A] p-6 shadow-2xl"
          >
            <div className="mb-2 text-xs uppercase tracking-widest text-[#555555]">
              ── REGISTRATION
            </div>
            <h2
              id="hacktober-registration-title"
              className="text-lg font-bold uppercase tracking-wide text-white"
            >
              {hackathon.name}
            </h2>
            <RegistrationFieldsForm
              displayName={resolvedDisplayName}
              onDisplayNameChange={setDisplayName}
              fields={hackathon.registrationFields ?? []}
              answers={registrationAnswers}
              onChange={setRegistrationAnswers}
              disabled={isJoining}
            />
            <div className="mt-5 flex justify-end gap-3 border-t border-[#1F1F1F] pt-4">
              <button
                type="button"
                onClick={closeRegistration}
                disabled={isJoining}
                className="border border-[#1F1F1F] px-4 py-2 text-xs uppercase tracking-wider text-[#555555] transition-colors hover:border-white hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRegistration}
                disabled={isJoining}
                className="bg-[#FF6600] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-white disabled:opacity-50"
              >
                {isJoining ? "Registering..." : "[ Register ]"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
