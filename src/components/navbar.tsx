"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, UserButton, useAuth, useUser } from "@clerk/nextjs";
import { Terminal, LayoutDashboard, Menu, X, Compass } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const isAuthenticated = !!isSignedIn;
  const isLoading = !isLoaded;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[#1F1F1F] bg-black">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Terminal className="h-5 w-5 text-[#00FF41]" />
          <span className="text-sm font-bold tracking-widest text-white uppercase group-hover:text-[#00FF41] transition-colors">
            HILLPOST
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          <Link
            href="/discover"
            className="flex items-center gap-2 px-3 py-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors border border-transparent hover:border-[#1F1F1F]"
          >
            <Compass className="h-3.5 w-3.5" />
            ~/discover
          </Link>
          {isAuthenticated && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors border border-transparent hover:border-[#1F1F1F]"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              ~/dashboard
            </Link>
          )}
        </div>

        {/* Auth Section */}
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {isLoading ? (
            <div className="h-7 w-20 bg-[#111111] border border-[#1F1F1F]" />
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#555555]">
                {user.firstName || user.username}
              </span>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7 rounded-none",
                  },
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="px-4 py-1.5 text-xs text-[#555555] uppercase tracking-wider border border-[#1F1F1F] hover:border-white hover:text-white transition-colors">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="px-4 py-1.5 text-xs font-bold text-black uppercase tracking-wider bg-[#00FF41] hover:bg-white transition-colors">
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            className="p-2 text-[#555555] hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "overflow-hidden border-t border-[#1F1F1F] transition-all duration-200 md:hidden",
          mobileMenuOpen ? "max-h-64" : "max-h-0 border-t-0"
        )}
      >
        <div className="space-y-1 px-4 py-3 bg-black">
          <Link
            href="/discover"
            className="flex items-center gap-2 px-3 py-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Compass className="h-3.5 w-3.5" />
            ~/discover
          </Link>
          {isAuthenticated && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-xs text-[#555555] uppercase tracking-wider hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              ~/dashboard
            </Link>
          )}
          {!isAuthenticated && !isLoading && (
            <div className="flex flex-col gap-2 pt-2">
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="w-full px-4 py-2 text-xs text-[#555555] uppercase tracking-wider border border-[#1F1F1F] hover:border-white hover:text-white transition-colors">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="w-full px-4 py-2 text-xs font-bold text-black uppercase tracking-wider bg-[#00FF41] hover:bg-white transition-colors">
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          )}
          {isAuthenticated && user && (
            <div className="flex items-center gap-3 border-t border-[#1F1F1F] pt-3 mt-2">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7 rounded-none",
                  },
                }}
              />
              <span className="text-xs text-[#555555]">
                {user.firstName || user.username}
              </span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
