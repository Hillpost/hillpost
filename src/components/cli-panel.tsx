"use client";

import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const INSTALL_COMMANDS = [
  "curl -fsSL https://hillpost.dev/install.sh | sh",
  "go install github.com/Hillpost/hillpost/cli/cmd/hillpost@latest",
];

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy. Please try again.");
    }
  };

  return (
    <button
      onClick={copy}
      title={`Copy ${label.toLowerCase()}`}
      aria-label={`Copy ${label.toLowerCase()}`}
      className="border border-[#1F1F1F] p-2 text-[#555555] transition-colors hover:border-white hover:text-white"
    >
      {copied ? (
        <Check className="h-4 w-4 text-[#00FF41]" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

function NewToken({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  return (
    <div className="border border-[#00FF41]/30 bg-black p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[#00FF41]">
        NEW TOKEN
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 border border-[#1F1F1F] bg-black px-3 py-2 text-xs break-all text-[#00FF41]">
          {token}
        </code>
        <CopyButton value={token} label="Token" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[#FF6600]">
          Copy it now. This is the only time it is shown.
        </p>
        <button
          onClick={onDismiss}
          className="border border-[#1F1F1F] px-3 py-1.5 text-xs uppercase tracking-wider text-[#555555] transition-colors hover:border-white hover:text-white"
        >
          DONE
        </button>
      </div>
    </div>
  );
}

export function CliPanel() {
  // listTokens throws without a credential, so wait for Convex to hold the
  // Clerk token rather than rendering an error on first paint.
  const { isAuthenticated } = useConvexAuth();
  const tokens = useQuery(api.cli.listTokens, isAuthenticated ? {} : "skip");
  const createToken = useMutation(api.cli.createToken);
  const revokeToken = useMutation(api.cli.revokeToken);

  const [label, setLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const result = await createToken({ label: label.trim() || "CLI" });
      setNewToken(result.token);
      setLabel("");
      toast.success("Token created");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create token";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const revoke = async (tokenId: Id<"cliTokens">) => {
    try {
      await revokeToken({ tokenId });
      toast.success("Token revoked");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to revoke token";
      toast.error(message);
    }
  };

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-[#555555]">── CLI</span>
        <div className="h-px flex-1 bg-[#1F1F1F]" />
      </div>

      <div className="space-y-6 border border-[#1F1F1F] bg-[#0A0A0A] p-5">
        {/* Install */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[#555555]">
            INSTALL:
          </div>
          <div className="mt-2 space-y-2">
            {INSTALL_COMMANDS.map((command) => (
              <div key={command} className="flex items-center gap-2">
                <code className="flex-1 border border-[#1F1F1F] bg-black px-3 py-2 text-xs break-all text-white">
                  <span className="mr-2 text-[#555555]">$</span>
                  {command}
                </code>
                <CopyButton value={command} label="Command" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#333333]">
            Then run <span className="text-[#555555]">hillpost login</span> and
            authorize the code it prints.
          </p>
        </div>

        {/* Tokens */}
        <div className="border-t border-[#1F1F1F] pt-5">
          <div className="text-xs font-bold uppercase tracking-widest text-[#555555]">
            TOKENS:
          </div>

          {tokens === undefined ? (
            <div className="mt-2 text-xs uppercase tracking-widest text-[#333333]">
              <span className="cursor-blink">░░░░░░░░</span>
            </div>
          ) : tokens.length === 0 ? (
            <p className="mt-2 text-xs text-[#333333]">
              No tokens yet. Sign in from the CLI or create one below.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-[#1F1F1F] border border-[#1F1F1F]">
              {tokens.map((token) => (
                <li
                  key={token._id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-white">
                        {token.label}
                      </span>
                      <code className="text-xs text-[#555555]">
                        {token.preview}...
                      </code>
                    </div>
                    <div className="mt-0.5 text-xs text-[#333333]">
                      Created {format(new Date(token.createdAt), "MMM d, yyyy")}
                      {" · "}
                      {token.lastUsedAt
                        ? `Last used ${format(new Date(token.lastUsedAt), "MMM d, yyyy")}`
                        : "Never used"}
                    </div>
                  </div>
                  <button
                    onClick={() => revoke(token._id)}
                    className="border border-[#1F1F1F] px-3 py-1.5 text-xs uppercase tracking-wider text-[#555555] transition-colors hover:border-[#FF6600] hover:text-[#FF6600]"
                  >
                    REVOKE
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Create */}
        <div className="border-t border-[#1F1F1F] pt-5">
          {newToken ? (
            <NewToken token={newToken} onDismiss={() => setNewToken(null)} />
          ) : (
            <form onSubmit={create} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-[#555555]">
                  NEW TOKEN LABEL:
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value.slice(0, 40))}
                  placeholder="Laptop"
                  className="tui-input placeholder-[#333333]"
                />
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="bg-[#00B4FF] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-white disabled:opacity-50"
              >
                {isCreating ? "CREATING..." : "[ CREATE TOKEN ]"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
