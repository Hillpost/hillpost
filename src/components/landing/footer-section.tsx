import { Terminal } from "lucide-react";

export function FooterSection() {
  return (
    <footer className="border-t border-[#1F1F1F] bg-black px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row sm:gap-0">
        <div className="flex items-center gap-2 text-[#555555]">
          <Terminal className="h-4 w-4 text-[#00FF41]" />
          <span className="text-xs uppercase tracking-widest">HILLPOST</span>
        </div>
        <nav className="flex items-center gap-6 text-xs uppercase tracking-widest">
          <a
            href="https://github.com/Hillpost/hillpost/blob/main/docs/cli/README.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#555555] hover:text-[#00FF41] transition-colors"
          >
            CLI
          </a>
          <a
            href="https://github.com/Hillpost/hillpost/tree/main/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#555555] hover:text-[#00FF41] transition-colors"
          >
            Docs
          </a>
        </nav>
        <p className="text-center text-xs text-[#333333] tracking-wider sm:text-right">
          Made with ♥ by{" "}
          <a
            href="https://github.com/Mcrich23"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#555555] hover:text-[#00FF41] transition-colors"
          >
            Morris Richman
          </a>
          {" "}+{" "}
          <a
            href="https://www.linkedin.com/in/cyruscorrell/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#555555] hover:text-[#00FF41] transition-colors"
          >
            Cyrus Correll
          </a>
        </p>
      </div>
    </footer>
  );
}
