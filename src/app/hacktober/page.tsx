import type { Metadata } from "next";
import {
  ArrowDown,
  CalendarDays,
  Clock3,
  Code2,
  Laptop,
  Mail,
  MapPin,
  Sparkles,
} from "lucide-react";
import { FooterSection } from "@/components/landing/footer-section";

const REGISTER_URL = "https://luma.com/a3dgd7y4";
const SPONSOR_EMAIL = "hacktober@hillpost.dev";
// Gmail compose opens in a tab instead of handing off to the OS mail app.
const SPONSOR_COMPOSE_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${SPONSOR_EMAIL}&su=Hacktober%20sponsorship`;

export const metadata: Metadata = {
  title: "Hacktober 2026 | Hillpost",
  description:
    "A month-long virtual hackathon by Hillpost. Build something interesting and open source, October 1–30, 2026.",
};

const schedule = [
  {
    date: "OCT 01",
    label: "Kickoff",
    detail: "Bring an existing open-source project or start something new. Both belong here.",
    icon: Code2,
  },
  {
    date: "OCT 01—29",
    label: "Build from anywhere",
    detail: "Ship at your own pace throughout the month. More event details are coming soon.",
    icon: Laptop,
  },
  {
    date: "OCT 30",
    label: "Finale in San Francisco",
    detail: "We close out Hacktober together in San Francisco. Venue to be announced.",
    icon: MapPin,
  },
];

export default function HacktoberPage() {
  return (
    <div className="bg-black text-white">
      <section className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden border-b border-[#1F1F1F] dot-grid">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(255,102,0,0.12),transparent_68%)]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between border-x border-[#1F1F1F] px-4 py-4 text-[10px] uppercase tracking-[0.2em] text-[#555555] sm:px-8">
            <span>Hillpost presents</span>
            <span className="text-[#FF6600]">Online / 30 days</span>
          </div>

          <div className="grid flex-1 border border-b-0 border-[#1F1F1F] lg:grid-cols-[1fr_18rem]">
            <div className="flex flex-col justify-center px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <div className="mb-8 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-[#FF6600]">
                <span className="status-pulse h-2 w-2 bg-[#FF6600]" />
                October 1—30, 2026
              </div>

              <h1 className="max-w-5xl text-5xl font-bold uppercase leading-[0.86] tracking-[-0.075em] sm:text-7xl md:text-8xl lg:text-[7.5rem]">
                Hack<span className="text-[#FF6600]">tober</span>
              </h1>

              <p className="mt-8 max-w-2xl text-base leading-7 text-[#888888] sm:text-lg">
                A month-long virtual hackathon for curious ideas built in the open.
              </p>

              <div className="mt-10 max-w-3xl border-l-2 border-[#FF6600] pl-5 sm:pl-7">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#FF6600]">
                  The prompt
                </p>
                <h2 className="text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
                  Build something interesting &amp; open source.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[#777777]">
                  Forget the business plan. Chase a strange idea, solve a problem,
                  or make something you simply want to exist. Publish the code so
                  other people can learn from it, use it, and make it better.
                </p>
                <p className="mt-4 text-sm font-bold text-white">
                  Already building something? Bring it. Projects started before
                  October are welcome.
                </p>
              </div>

              <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <a
                  href={REGISTER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 border border-[#FF6600] bg-[#FF6600] px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:border-white hover:bg-white"
                >
                  [ Register on Luma ]
                </a>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#444444]">
                  Free · Registration is open
                </span>
              </div>
            </div>

            <aside className="grid border-t border-[#1F1F1F] lg:border-l lg:border-t-0">
              <EventFact icon={CalendarDays} label="Dates" value="Oct 1—30" />
              <EventFact icon={Laptop} label="Format" value="Virtual" />
              <EventFact icon={MapPin} label="Finale" value="San Francisco" />
              <EventFact icon={Clock3} label="Venue" value="To be announced" />
            </aside>
          </div>

          <a
            href="#brief"
            className="flex items-center justify-center gap-2 border-x border-t border-[#1F1F1F] py-4 text-[10px] uppercase tracking-[0.2em] text-[#555555] transition-colors hover:text-white"
          >
            Read the overview <ArrowDown className="h-3 w-3" />
          </a>
        </div>
      </section>

      <section id="brief" className="border-b border-[#1F1F1F] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.65fr_1.35fr] lg:gap-20">
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[#FF6600]">01 / Overview</p>
            <h2 className="text-3xl font-bold uppercase leading-tight sm:text-4xl">
              Follow what interests you.
            </h2>
          </div>

          <div className="space-y-8 text-base leading-8 text-[#888888]">
            <p>
              Bring the project you started yesterday, the one you have worked on
              for two months, or the idea still hiding in your notes app. It could
              be useful, playful, deeply technical, or hard to explain. If you care
              about it and the source is open, we want to see it.
            </p>
            <p className="text-white">
              You do not need a market or a pitch deck. Put the source where
              others can see it, document what you learned, and leave the door
              open for someone else to contribute.
            </p>
            <div className="grid gap-px border border-[#1F1F1F] bg-[#1F1F1F] sm:grid-cols-2">
              <BriefCard
                icon={Sparkles}
                title="New or ongoing"
                copy="Start during Hacktober or share what you have already been building. There is no freshness test."
              />
              <BriefCard
                icon={Code2}
                title="Build in public"
                copy="Share the source, explain how it works, and give other people room to take it somewhere new."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1F1F1F] bg-[#0A0A0A] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[#FF6600]">02 / Timeline</p>
              <h2 className="text-3xl font-bold uppercase sm:text-4xl">One month to make it real.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#666666]">
              Hacktober runs online, then wraps with an in-person finale in San Francisco.
            </p>
          </div>

          <ol className="grid gap-px border border-[#1F1F1F] bg-[#1F1F1F] lg:grid-cols-3">
            {schedule.map((item, index) => (
              <li key={item.date} className="group bg-black p-6 sm:p-8">
                <div className="mb-12 flex items-start justify-between">
                  <span className="text-xs font-bold tracking-[0.18em] text-[#FF6600]">{item.date}</span>
                  <span className="text-xs text-[#444444]">0{index + 1}</span>
                </div>
                <item.icon className="mb-5 h-5 w-5 text-[#777777] transition-colors group-hover:text-[#FF6600]" />
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">{item.label}</h3>
                <p className="text-xs leading-6 text-[#666666]">{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pb-14 lg:pt-28">
        <div className="mx-auto max-w-4xl border border-[#1F1F1F] bg-[#0A0A0A] px-6 py-12 text-center sm:px-12 sm:py-16">
          <p className="mb-5 text-xs uppercase tracking-[0.2em] text-[#FF6600]">Oct 1—30, 2026</p>
          <h2 className="text-3xl font-bold uppercase sm:text-5xl">Make something worth opening up.</h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-[#777777]">
            Grab your spot now. Full event details will follow closer to kickoff.
          </p>
          <a
            href={REGISTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-3 border border-[#FF6600] bg-[#FF6600] px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:border-white hover:bg-white"
          >
            [ Register on Luma ]
          </a>
        </div>
      </section>

      <section className="border-b border-[#1F1F1F] px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-20 lg:pt-10">
        <div className="mx-auto grid max-w-6xl gap-8 border border-[#1F1F1F] bg-[#0A0A0A] p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
          <div>
            <h2 className="text-2xl font-bold uppercase sm:text-3xl">Want to sponsor Hacktober?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#777777]">
              Help us give open-source builders a place to share their work and
              bring the community together in San Francisco.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <a
              href={SPONSOR_COMPOSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-3 border border-[#FF6600] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-[#FF6600] transition-colors hover:bg-[#FF6600] hover:text-black"
            >
              <Mail className="h-4 w-4" />
              [ Get in touch ]
            </a>
            <a
              href={`mailto:${SPONSOR_EMAIL}?subject=Hacktober%20sponsorship`}
              className="text-[10px] uppercase tracking-[0.18em] text-[#555555] transition-colors hover:text-white"
            >
              or email {SPONSOR_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}

type IconType = React.ComponentType<{ className?: string }>;

function EventFact({ icon: Icon, label, value }: { icon: IconType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-[#1F1F1F] px-6 py-6 last:border-b-0 lg:block lg:px-7">
      <Icon className="h-4 w-4 shrink-0 text-[#FF6600] lg:mb-5" />
      <div>
        <p className="mb-1 text-[9px] uppercase tracking-[0.2em] text-[#555555]">{label}</p>
        <p className="text-xs font-bold uppercase tracking-wider text-white">{value}</p>
      </div>
    </div>
  );
}

function BriefCard({ icon: Icon, title, copy }: { icon: IconType; title: string; copy: string }) {
  return (
    <div className="bg-black p-6 sm:p-7">
      <Icon className="mb-8 h-5 w-5 text-[#FF6600]" />
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-white">{title}</h3>
      <p className="text-xs leading-6 text-[#666666]">{copy}</p>
    </div>
  );
}
