"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { getClerkDisplayName } from "@/lib/clerk-user";

/** Device codes get typed by hand: accept any casing and spacing. */
function normaliseCode(raw: string): string {
  const letters = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return letters.length > 4 ? `${letters.slice(0, 4)}-${letters.slice(4)}` : letters;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8 border-b border-[#1F1F1F] pb-6">
        <div className="mb-1 text-xs text-[#555555] uppercase tracking-widest">
          ~/hillpost/cli/login
        </div>
        <h1 className="text-2xl font-bold text-white uppercase tracking-wide">
          AUTHORIZE CLI
          <span className="cursor-blink ml-2">▊</span>
        </h1>
        <p className="mt-1 text-xs text-[#555555] uppercase tracking-wider">
          Connect a terminal to your Hillpost account
        </p>
      </div>
      {children}
    </div>
  );
}

function Message({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "green" | "muted";
}) {
  return (
    <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-6 text-center">
      <p
        className={`text-sm font-bold uppercase tracking-wide ${
          tone === "green" ? "text-[#00FF41]" : "text-[#555555]"
        }`}
      >
        {title}
      </p>
      <p className="mt-2 text-xs text-[#555555]">{body}</p>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-6 text-center text-xs uppercase tracking-widest text-[#555555]">
      <span className="cursor-blink">▓▓▓░░░</span> {label}
    </div>
  );
}

function CodeForm({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code);
      }}
      className="space-y-5"
    >
      <div>
        <label className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest">
          LOGIN CODE:
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#555555]">
            &gt;
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(normaliseCode(e.target.value))}
            placeholder="XXXX-XXXX"
            className="tui-input pl-8 text-center text-lg font-bold tracking-widest text-[#00FF41] placeholder-[#333333]"
            required
          />
        </div>
        <p className="mt-1.5 text-center text-xs text-[#333333]">
          Your terminal shows this code after you run{" "}
          <span className="text-[#555555]">hillpost login</span>.
        </p>
      </div>

      <button
        type="submit"
        disabled={code.length < 9}
        className="w-full bg-[#00B4FF] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-white disabled:opacity-50"
      >
        [ CONTINUE ]
      </button>
    </form>
  );
}

function AuthorizeDevice({ userCode }: { userCode: string }) {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const device = useQuery(
    api.cli.getDevice,
    isAuthenticated ? { userCode } : "skip"
  );
  const approveDevice = useMutation(api.cli.approveDevice);

  const [isApproving, setIsApproving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const approve = async () => {
    setIsApproving(true);
    try {
      await approveDevice({
        userCode,
        userName: getClerkDisplayName(user),
        userImageUrl: user?.imageUrl,
      });
      toast.success("Device authorized");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to authorize this device";
      toast.error(message);
    } finally {
      setIsApproving(false);
    }
  };

  if (device === undefined) return <Loading label="CHECKING CODE..." />;

  if (device === null) {
    return (
      <Message
        title="UNKNOWN CODE"
        body={`We have no record of ${userCode}. Codes expire after 10 minutes, so run hillpost login again to get a new one.`}
        tone="muted"
      />
    );
  }

  if (device.status === "approved") {
    return (
      <Message
        title="DEVICE AUTHORIZED"
        body="Return to your terminal. The CLI is signed in and ready to use."
        tone="green"
      />
    );
  }

  if (device.expiresAt <= now) {
    return (
      <Message
        title="CODE EXPIRED"
        body="This code is older than 10 minutes. Run hillpost login again to get a new one."
        tone="muted"
      />
    );
  }

  const secondsLeft = Math.max(0, Math.round((device.expiresAt - now) / 1000));
  const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-bold text-[#555555] uppercase tracking-widest">
          LOGIN CODE:
        </label>
        <code className="mt-2 block border border-[#1F1F1F] bg-black px-4 py-3 text-center text-xl font-bold tracking-widest text-[#00FF41]">
          {userCode}
        </code>
        <p className="mt-1.5 text-center text-xs text-[#333333]">
          Expires in {countdown}. Check it matches the code in your terminal.
        </p>
      </div>

      <button
        onClick={approve}
        disabled={isApproving}
        className="w-full bg-[#00FF41] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-white disabled:opacity-50"
      >
        {isApproving ? "AUTHORIZING..." : "[ AUTHORIZE THIS DEVICE ]"}
      </button>

      <p className="text-center text-xs text-[#333333]">
        This terminal gets access to your hackathons until you revoke its token
        from the dashboard.
      </p>
    </div>
  );
}

function CliLogin() {
  const searchParams = useSearchParams();
  const [typedCode, setTypedCode] = useState<string | null>(null);
  const userCode = typedCode ?? normaliseCode(searchParams.get("code") ?? "");

  return (
    <Frame>
      {userCode.length === 9 ? (
        <AuthorizeDevice userCode={userCode} />
      ) : (
        <CodeForm onSubmit={setTypedCode} />
      )}
    </Frame>
  );
}

export default function CliLoginPage() {
  return (
    <Suspense
      fallback={
        <Frame>
          <Loading label="LOADING..." />
        </Frame>
      }
    >
      <CliLogin />
    </Suspense>
  );
}
