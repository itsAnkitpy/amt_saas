import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dashboardPreview from "../../public/dashboard.png";
import {
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
  Zap,
  BarChart3,
  Search,
  Smartphone,
  X,
  ArrowRight,
  Plus
} from "lucide-react";

// --- Copy & Data ---

const FEATURES = [
  {
    id: "tracking",
    title: "Asset Tracking",
    description: "Every asset in one place, with a QR label and a full history.",
    icon: Search,
    benefits: [
      "QR & barcode scanning with printable labels",
      "Assign and unassign assets to teammates",
      "Complete activity history on every asset",
      "Custom fields per category for your own data"
    ]
  },
  {
    id: "maintenance",
    title: "Maintenance",
    description: "Recurring schedules so servicing never slips through the cracks.",
    icon: Zap,
    benefits: [
      "Recurring maintenance schedules per asset",
      "Track jobs from due to in-progress to done",
      "Due-soon and overdue alerts",
      "Service notes and costs on every job"
    ]
  },
  {
    id: "reporting",
    title: "Dashboard & Alerts",
    description: "A live overview of status, condition, and what needs attention.",
    icon: BarChart3,
    benefits: [
      "Status, category, and condition charts",
      "Warranty expiry alerts before it's too late",
      "Action center for items needing attention",
      "Workspace-wide activity audit trail"
    ]
  }
];

const PAIN_POINTS = [
  {
    title: "Spreadsheet Sprawl",
    description: "Duplicate entries, version conflicts, and 'which sheet is the latest?' confusion.",
    quote: "I spend more time tracking than managing."
  },
  {
    title: "Asset Visibility Gaps",
    description: "Lost assets, surprise failures, and ghost inventory costing you thousands.",
    quote: "Where is that projector we bought last year?"
  },
  {
    title: "Audit Nightmares",
    description: "Last-minute scrambles and compliance risks when auditors come calling.",
    quote: "Auditors are coming and I'm not ready."
  },
  {
    title: "Multi-Location Chaos",
    description: "Inconsistent processes and siloed data across different sites.",
    quote: "Each location does it their own way."
  }
];

const FAQS = [
  {
    question: "We already track assets in a spreadsheet. How do we move over?",
    answer: "Use the built-in CSV importer. Download the template, fill it from your existing sheet, and upload. Every row is validated before anything is written, so bad data never lands in your workspace."
  },
  {
    question: "Is our data secure?",
    answer: "Each workspace's data is fully isolated — every query and every page is scoped to your workspace and checked against your access. Sign-in is handled by Clerk, so passwords never touch our servers."
  },
  {
    question: "What does it cost?",
    answer: "AssetLane is free to use while in early access — no credit card required. Paid plans will come later, with clear notice before anything changes."
  },
  {
    question: "Can my team use it too?",
    answer: "Yes. Invite teammates by email and set their role — Admin, Manager, or User — to control who can manage assets, categories, and settings."
  }
];

// --- Components ---

function Section({ children, className = "", id = "" }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`py-20 md:py-28 ${className}`}>
      {children}
    </section>
  );
}

function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeading({ badge, title, subtitle }: { badge?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-16 text-center">
      {badge && <Badge variant="secondary" className="mb-4 text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 hover:bg-violet-200">{badge}</Badge>}
      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// --- Main Page Component ---

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 font-sans selection:bg-violet-100 selection:text-violet-900">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white transition-transform group-hover:scale-105">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">AssetLane</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-zinc-600 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-white transition-colors">Features</Link>
            <Link href="#faq" className="text-sm font-medium text-zinc-600 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-white transition-colors">FAQ</Link>
          </div>

          <div className="flex items-center gap-4">
            {userId ? (
              <Link href="/dashboard">
                <Button>Dashboard <ChevronRight className="ml-1 h-4 w-4" /></Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="hidden sm:block">
                  <Button variant="ghost" className="text-zinc-600 dark:text-zinc-300">
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </Container>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28">
          <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-violet-200 to-indigo-200 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" }}></div>
          </div>

          <Container className="text-center">
            <Badge variant="outline" className="mb-8 px-4 py-1.5 rounded-full border-zinc-200 text-zinc-600 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:text-zinc-300">
              <span className="mr-1.5 flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
              New: Scan assets with your phone camera
            </Badge>

            <h1 className="mx-auto max-w-5xl text-5xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-6xl lg:text-7xl mb-8">
              Track Every Asset. <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Eliminate Downtime.</span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400 mb-10 leading-relaxed">
              QR-code asset management for teams that have outgrown spreadsheets. Track, assign, and maintain every asset from one shared workspace.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href={userId ? "/dashboard" : "/sign-up"} className="w-full sm:w-auto">
                <Button size="lg" className="w-full h-14 px-8 text-lg bg-violet-600 hover:bg-violet-700 shadow-xl shadow-violet-500/20">
                  {userId ? "Go to Dashboard" : "Start Free"} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              {!userId && (
                <Link href="/sign-in" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full h-14 px-8 text-lg border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>

            <div className="flex items-center justify-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Isolated workspace per team</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Free while in early access</span>
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-emerald-500" /> Set up in minutes</span>
            </div>

            {/* Hero Image Mockup */}
            <div className="mt-16 relative mx-auto w-full max-w-6xl rounded-2xl border border-zinc-200 bg-zinc-50/50 p-2 sm:p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <Image
                  src={dashboardPreview}
                  alt="AssetLane dashboard preview"
                  className="h-auto w-full object-contain"
                  sizes="(min-width: 1280px) 72rem, (min-width: 768px) 92vw, 100vw"
                  priority
                />
              </div>
            </div>
          </Container>
        </section>

        {/* Problem/Agitation Section */}
        <Section className="bg-white dark:bg-zinc-950">
          <Container>
            <SectionHeading
              badge="The Problem"
              title="Sound Familiar?"
              subtitle="Managing assets with spreadsheets works... until it doesn't."
            />

            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
              {PAIN_POINTS.map((pain, i) => (
                <div key={i} className="relative pl-8 border-l-2 border-red-100 dark:border-red-900/30">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{pain.title}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 mb-4">{pain.description}</p>
                  <p className="text-sm italic text-red-500 dark:text-red-400">
                    &ldquo;{pain.quote}&rdquo;
                  </p>
                </div>
              ))}
            </div>

          </Container>
        </Section>

        {/* Solution/Benefits Section */}
        <Section id="features" className="bg-zinc-50/50 dark:bg-zinc-900/30">
          <Container>
            <SectionHeading
              badge="The Solution"
              title="One Platform. Complete Visibility."
              subtitle="Go from asset chaos to clarity in 30 days."
            />

            <div className="grid lg:grid-cols-3 gap-8">
              {FEATURES.map((feature) => (
                <Card key={feature.id} className="border-0 shadow-lg shadow-zinc-200/50 dark:shadow-none dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center mb-4 dark:bg-violet-900/30 dark:text-violet-400">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">{feature.description}</p>
                    <ul className="space-y-3">
                      {feature.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Container>
        </Section>

        {/* Feature Deep Dive (Tabs Replacement - Stacked for now for simplicity & SEO) */}
        <Section>
          <Container>
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              <div className="lg:w-1/2">
                <Badge className="mb-6 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 border-0">QR Scanning</Badge>
                <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-6">
                  Scan. Track. Done.
                </h2>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
                  Every asset gets a printable QR label. Point any phone camera at it to pull up the asset instantly — right in the browser, nothing to install.
                </p>
                <ul className="space-y-4 mb-8">
                  {[
                    "Instant QR & barcode lookup",
                    "Assign or unassign right from the scan screen",
                    "Printable QR labels for every asset",
                    "Works in any mobile browser — no app needed"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 font-medium text-zinc-900 dark:text-zinc-200">
                      <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center dark:bg-indigo-900/50 dark:text-indigo-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={userId ? "/dashboard" : "/sign-up"}>
                  <Button variant="outline" className="h-12 border-zinc-200 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:text-white dark:hover:bg-zinc-900 group">
                    Try Scanning Free <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
              <div className="lg:w-1/2">
                <div className="relative rounded-2xl bg-zinc-900 p-2 shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 rotate-1 transform transition-transform hover:rotate-0 duration-500">
                  <div className="aspect-[4/3] rounded-xl bg-zinc-800 overflow-hidden relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Smartphone className="h-20 w-20 text-zinc-600" />
                    </div>
                    {/* Mockup decoration */}
                    <div className="absolute top-4 left-4 right-4 h-8 bg-zinc-700/50 rounded-full w-1/3"></div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </Section>

        {/* FAQ Section */}
        <Section id="faq">
          <Container className="max-w-4xl">
            <SectionHeading
              title="Frequently Asked Questions"
            />
            <div className="space-y-4">
              {FAQS.map((faq, i) => (
                <details key={i} className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 open:ring-2 open:ring-violet-500/20">
                  <summary className="flex cursor-pointer list-none items-center justify-between p-6 font-medium text-zinc-900 dark:text-white group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/50 rounded-xl transition-colors">
                    {faq.question}
                    <span className="ml-4 transition-transform group-open:rotate-45">
                      <Plus className="h-5 w-5 text-zinc-400 group-open:hidden" />
                      <X className="h-5 w-5 text-zinc-400 hidden group-open:block" />
                    </span>
                  </summary>
                  <div className="px-6 pb-6 pt-0 text-zinc-600 dark:text-zinc-400">
                    <p className="mt-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </Container>
        </Section>

        {/* Final CTA */}
        <Section className="bg-zinc-950 py-24 sm:py-32">
          <Container className="text-center">
            <h2 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white mb-6 sm:text-5xl">
              Ready to Take Control of Your Assets?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400 mb-10">
              Create your workspace in minutes, import your spreadsheet, and know where every asset is.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href={userId ? "/dashboard" : "/sign-up"} className="w-full sm:w-auto">
                <Button size="lg" className="w-full h-14 px-8 text-lg bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
                  {userId ? "Go to Dashboard" : "Start Free"}
                </Button>
              </Link>
              {!userId && (
                <Link href="/sign-in" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full h-14 px-8 text-lg border-zinc-700 text-white hover:bg-zinc-800 hover:text-white dark:border-zinc-700">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-zinc-500">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> No credit card required</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Free while in early access</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> CSV import built in</span>
            </div>
          </Container>
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-white pt-16 pb-8 dark:border-zinc-800 dark:bg-zinc-950">
        <Container>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-3 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
                <span className="text-xl font-bold text-zinc-900 dark:text-white">AssetLane</span>
              </Link>
              <p className="max-w-xs text-sm text-zinc-500 leading-relaxed">
                QR-code asset management for teams that have outgrown spreadsheets.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <li><Link href="#features" className="hover:text-violet-600">Features</Link></li>
                <li><Link href="#faq" className="hover:text-violet-600">FAQ</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-4">Get Started</h4>
              <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <li><Link href="/sign-up" className="hover:text-violet-600">Create a workspace</Link></li>
                <li><Link href="/sign-in" className="hover:text-violet-600">Sign in</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-8 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} AssetLane. All rights reserved.
            </p>
            <div className="flex gap-6">
              {/* Social icons would go here */}
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
}
