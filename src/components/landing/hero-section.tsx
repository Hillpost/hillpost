"use client";

import Link from "next/link";
import { SignInButton, useAuth, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState, useEffect } from "react";

const TYPEWRITER_TEXT = "HACK THE HILL";
const INSTALL_COMMAND = "curl -fsSL https://hillpost.dev/install.sh | sh";

function InstallCommand() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy install command"
      aria-label="Copy install command"
      className="group flex items-center gap-3 border border-[#1F1F1F] px-4 py-3 font-mono text-sm text-[#555555] transition-all hover:border-white hover:text-white"
    >
      <span className="text-[#00FF41]">$</span>
      <code>{INSTALL_COMMAND}</code>
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-[#00FF41]" />
      ) : (
        <Copy className="h-4 w-4 shrink-0" />
      )}
    </button>
  );
}

export function HeroSection() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [typed, setTyped] = useState("");

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < TYPEWRITER_TEXT.length) {
        setTyped(TYPEWRITER_TEXT.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center overflow-hidden px-4 text-center dot-grid">
      {/* Corner brackets */}
      <div className="pointer-events-none absolute inset-4 hidden sm:block">
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-[#1F1F1F]" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[#1F1F1F]" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-[#1F1F1F]" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-[#1F1F1F]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl">
        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 inline-flex items-center gap-2 border border-[#00FF41]/30 bg-[#00FF4108] px-4 py-1.5 text-xs uppercase tracking-widest text-[#00FF41]"
        >
          <span className="status-pulse h-1.5 w-1.5 bg-[#00FF41] inline-block" />
          Live Hackathon Judging Platform
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h1 className="mb-2 text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl uppercase">
            HILLPOST
          </h1>
          <div className="mb-2 text-sm text-[#555555] uppercase tracking-widest">
            v1.0
          </div>
          <div className="mb-6 flex justify-center font-mono">
            <span className="text-xl font-bold text-[#00FF41]">
              {typed}<span className="cursor-blink">▊</span>
            </span>
          </div>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mx-auto mb-10 max-w-2xl text-sm leading-relaxed text-[#555555] sm:text-base"
        >
          The ultimate{" "}
          <span className="text-white font-bold">
            king-of-the-hill
          </span>{" "}
          style hackathon judging platform. Teams compete, judges score in
          real-time, and the leaderboard updates live.{" "}
          <span className="text-[#00FF41]">May the best hackers reign supreme.</span>
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          {isSignedIn && user ? (
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 border border-[#00FF41] bg-[#00FF41] px-8 py-3 text-sm font-bold text-black uppercase tracking-wider transition-all hover:bg-white hover:border-white"
            >
              [ GO TO DASHBOARD → ]
            </Link>
          ) : (
            <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
              <button className="group flex items-center gap-2 border border-[#00FF41] bg-[#00FF41] px-8 py-3 text-sm font-bold text-black uppercase tracking-wider transition-all hover:bg-white hover:border-white">
                [ GET STARTED → ]
              </button>
            </SignInButton>
          )}
          <InstallCommand />
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-[#333333] uppercase tracking-widest">
        ↓ SCROLL
      </div>
    </section>
  );
}
