"use client";

import { useCallback, useRef, useState } from "react";
import { UserRound, X } from "lucide-react";
import { getClerkDisplayName } from "@/lib/clerk-user";

type ClerkDisplayUser = Parameters<typeof getClerkDisplayName>[0];

type DisplayNamePromptOptions = {
  confirm?: boolean;
};

function cleanDisplayName(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

interface DisplayNamePromptDialogProps {
  isOpen: boolean;
  name: string;
  error: string | undefined;
  onNameChange: (name: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function DisplayNamePromptDialog({
  isOpen,
  name,
  error,
  onNameChange,
  onCancel,
  onSubmit,
}: DisplayNamePromptDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80" onClick={onCancel} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="relative z-10 w-full max-w-sm border border-[#1F1F1F] bg-black p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between border-b border-[#1F1F1F] pb-4">
          <div>
            <div className="mb-1 text-xs text-[#555555] uppercase tracking-widest">
              -- PROFILE CHECK
            </div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white uppercase tracking-wide">
              <UserRound className="h-4 w-4 text-[#00FF41]" />
              DISPLAY NAME
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-[#555555] transition-colors hover:text-white"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
          NAME:
        </label>
        <p className="mb-3 text-xs leading-relaxed text-[#555555]">
          Confirm the name other participants will see.
        </p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#555555]">
            &gt;
          </span>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Your name"
            maxLength={80}
            className="tui-input pl-8"
          />
        </div>
        {error && (
          <p className="mt-2 text-xs font-bold text-[#FF6600] uppercase tracking-wider">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3 border-t border-[#1F1F1F] pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs text-[#555555] border border-[#1F1F1F] uppercase tracking-wider transition-colors hover:border-white hover:text-white"
          >
            CANCEL
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold text-black bg-[#00FF41] uppercase tracking-wider transition-colors hover:bg-white"
          >
            CONTINUE
          </button>
        </div>
      </form>
    </div>
  );
}

export function useDisplayNamePrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const resolverRef = useRef<((name: string | undefined) => void) | undefined>(
    undefined
  );

  const closePrompt = useCallback((resolvedName: string | undefined) => {
    resolverRef.current?.(resolvedName);
    resolverRef.current = undefined;
    setIsOpen(false);
    setName("");
    setError(undefined);
  }, []);

  const requestDisplayName = useCallback((
    user: ClerkDisplayUser,
    options: DisplayNamePromptOptions = {}
  ) => {
    const displayName = getClerkDisplayName(user);
    if (displayName && !options.confirm) return Promise.resolve(displayName);

    setName(displayName ?? "");
    setError(undefined);
    setIsOpen(true);

    return new Promise<string | undefined>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const submitPrompt = useCallback(() => {
    const displayName = cleanDisplayName(name);
    if (!displayName) {
      setError("Please enter your name");
      return;
    }
    closePrompt(displayName);
  }, [closePrompt, name]);

  return {
    requestDisplayName,
    displayNamePrompt: (
      <DisplayNamePromptDialog
        isOpen={isOpen}
        name={name}
        error={error}
        onNameChange={setName}
        onCancel={() => closePrompt(undefined)}
        onSubmit={submitPrompt}
      />
    ),
  };
}
