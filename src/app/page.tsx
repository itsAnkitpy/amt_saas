import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
  Zap,
  BarChart3,
  Search,
  Users,
  Smartphone,
  FileText,
  Menu,
  X,
  ArrowRight,
  Minus,
  Plus
} from "lucide-react";

// --- Copy & Data ---

const FEATURES = [
  {
    id: "tracking",
    title: "Asset Tracking",
    description: "Track all your assets in one place. From hardware to software licenses.",
    icon: Search,
    benefits: [
      "Real-time asset location tracking",
      "QR & Barcode scanning support",
      "Complete asset lifecycle history",
      "Custom fields for unique requirements"
    ]
  },
  {
    id: "maintenance",
    title: "Maintenance",
    description: "Proactive maintenance scheduling to reduce downtime.",
    icon: Zap,
    benefits: [
      "Automated maintenance schedules",
      "Service history logging",
      "Downtime tracking & alerts",
      "Vendor management integration"
    ]
  },
  {
    id: "reporting",
    title: "Reporting",
    description: "Deep insights into asset utilization and costs.",
    icon: BarChart3,
    benefits: [
      "Depreciation calculations",
      "Cost of ownership analysis",
      "Audit-ready compliance reports",
      "Customizable dashboards"
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

const SOCIAL_PROOF_LOGOS = [
  "Acme Corp", "Global Tech", "Nebula Include", "Vertex Systems", "Horizon Group"
];

const TESTIMONIALS = [
  {
    quote: "Before AMT, we were managing assets across 12 locations using spreadsheets. We'd lose track of equipment constantly. Now we have 100% visibility.",
    author: "Sarah Chen",
    role: "Director of Operations",
    company: "Acme Manufacturing"
  },
  {
    quote: "We implemented AMT in 2 weeks and saw results immediately. Reduced asset loss by 60% and saved over $200,000 in the first year.",
    author: "Michael Ross",
    role: "IT Director",
    company: "Vertex Systems"
  },
  {
    quote: "Finally, an asset management system that actually works for multi-tenant setups. The audit reports save us weeks of work.",
    author: "Jessica Li",
    role: "Financial Controller",
    company: "Global Tech"
  }
];

const FAQS = [
  {
    question: "We already have a system in place. Migration seems painful.",
    answer: "We offer white-glove onboarding with free data migration. Our implementation team has migrated 500+ organizations from spreadsheets, legacy systems, and competitors. Average migration time is just 2 weeks."
  },
  {
    question: "How long until we see ROI?",
    answer: "Most customers report measurable time savings within the first month. On average, teams save 12 hours per week on manual tracking. That translates to thousands in recovered productivity immediately."
  },
  {
    question: "Is our data secure?",
    answer: "Yes. We're SOC 2 Type II certified and GDPR compliant. Your data is encrypted at rest and in transit. Our multi-tenant architecture ensures complete data isolation for every workspace."
  },
  {
    question: "What if we need to scale to more locations?",
    answer: "Our architecture is built for scale. Pricing is per-asset, not per-location, so you can expand endlessly without hidden costs or infrastructure headaches."
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
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">AMT</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-zinc-600 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-white transition-colors">Features</Link>
            <Link href="#social-proof" className="text-sm font-medium text-zinc-600 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-white transition-colors">Customers</Link>
            <Link href="#faq" className="text-sm font-medium text-zinc-600 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-white transition-colors">FAQ</Link>
          </div>

          <div className="flex items-center gap-4">
            {userId ? (
              <Link href="/dashboard">
                <Button>Dashboard <ChevronRight className="ml-1 h-4 w-4" /></Button>
              </Link>
            ) : (
              <Link href="/sign-in">
                <Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20">
                  Sign In
                </Button>
              </Link>
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
              New: Mobile Scanning App Included
            </Badge>

            <h1 className="mx-auto max-w-5xl text-5xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-6xl lg:text-7xl mb-8">
              Track Every Asset. <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Eliminate Downtime.</span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400 mb-10 leading-relaxed">
              The multi-tenant asset management platform trusted by 500+ operations teams to manage 2M+ assets across multiple locations. Finally escape spreadsheet chaos.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="#contact" className="w-full sm:w-auto">
                <Button size="lg" className="w-full h-14 px-8 text-lg bg-violet-600 hover:bg-violet-700 shadow-xl shadow-violet-500/20">
                  Request a Demo <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/sign-in" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full h-14 px-8 text-lg border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                  Sign In
                </Button>
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" /> SOC 2 Certified</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> 14-Day Free Trial</span>
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-emerald-500" /> Setup in 5 mins</span>
            </div>

            {/* Hero Image Mockup */}
            <div className="mt-16 relative mx-auto max-w-5xl rounded-2xl border border-zinc-200 bg-zinc-50/50 p-2 sm:p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="aspect-[16/9] overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 relative group">
                <Image
                  src="/dashboard.png"
                  alt="AMT Dashboard Preview"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </Container>
        </section>

        {/* Social Proof Section */}
        <section id="social-proof" className="border-y border-zinc-100 bg-zinc-50/50 py-12 dark:border-zinc-800 dark:bg-zinc-900/50">
          <Container>
            <p className="text-center text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-8">Trusted by 500+ Operations Teams</p>
            <div className="grid grid-cols-2 gap-8 md:grid-cols-5 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
              {SOCIAL_PROOF_LOGOS.map((logo, i) => (
                <div key={i} className="flex items-center justify-center">
                  <div className="h-8 w-32 bg-zinc-300 dark:bg-zinc-700 rounded animate-pulse opacity-50 flex items-center justify-center text-xs text-white font-bold">{logo}</div>
                </div>
              ))}
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
                  <p className="text-sm italic text-red-500 dark:text-red-400">"{pain.quote}"</p>
                </div>
              ))}
            </div>

            <div className="mt-16 bg-zinc-50 rounded-2xl p-8 border border-zinc-100 text-center dark:bg-zinc-900 dark:border-zinc-800">
              <p className="text-lg font-medium text-zinc-900 dark:text-white mb-6">
                The average operations team loses <span className="text-red-600 font-bold">12 hours per week</span> to manual asset tracking.
                <br className="hidden sm:block" /> That's 624 hours per year. What would you do with that time back?
              </p>
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
                <Badge className="mb-6 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 border-0">Mobile Scanning</Badge>
                <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-6">
                  Scan. Track. Done.
                </h2>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
                  Turn every smartphone on your team into a powerful enterprise scanner. Update asset locations, assign equipment, or perform audits in seconds.
                </p>
                <ul className="space-y-4 mb-8">
                  {[
                    "Instant QR & Barcode lookup",
                    "Offline mode support",
                    "Photo attachments for damage reports",
                    "GPS location tagging"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 font-medium text-zinc-900 dark:text-zinc-200">
                      <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center dark:bg-indigo-900/50 dark:text-indigo-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="h-12 border-zinc-200 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:text-white dark:hover:bg-zinc-900 group">
                  Explore Mobile Features <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
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

        {/* Testimonials */}
        <Section className="bg-zinc-50 dark:bg-zinc-900/30 text-center">
          <Container>
            <SectionHeading
              title="What Our Customers Say"
              subtitle="Join 500+ teams who have transformed their operations."
            />
            <div className="grid md:grid-cols-3 gap-8">
              {TESTIMONIALS.map((t, i) => (
                <Card key={i} className="bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 shadow-sm p-6 text-left">
                  <div className="mb-6 flex gap-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map(star => <svg key={star} className="h-5 w-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300 italic mb-6">"{t.quote}"</p>
                  <div className="mt-auto">
                    <p className="font-semibold text-zinc-900 dark:text-white">{t.author}</p>
                    <p className="text-sm text-zinc-500">{t.role}, {t.company}</p>
                  </div>
                </Card>
              ))}
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
              Join 500+ operations teams who've eliminated spreadsheet chaos and gained complete asset visibility.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="#contact" className="w-full sm:w-auto">
                <Button size="lg" className="w-full h-14 px-8 text-lg bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
                  Request a Demo
                </Button>
              </Link>
              <Link href="/sign-in" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full h-14 px-8 text-lg border-zinc-700 text-white hover:bg-zinc-800 hover:text-white dark:border-zinc-700">
                  Sign In
                </Button>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-zinc-500">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> No credit card required</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Free data migration</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Cancel anytime</span>
            </div>
          </Container>
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-white pt-16 pb-8 dark:border-zinc-800 dark:bg-zinc-950">
        <Container>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5 mb-12">
            <div className="col-span-2 lg:col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
                <span className="text-xl font-bold text-zinc-900 dark:text-white">AMT</span>
              </Link>
              <p className="max-w-xs text-sm text-zinc-500 leading-relaxed">
                The modern asset management platform for forward-thinking operations teams.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <li><Link href="#" className="hover:text-violet-600">Features</Link></li>
                <li><Link href="#" className="hover:text-violet-600">Pricing</Link></li>
                <li><Link href="#" className="hover:text-violet-600">Mobile App</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <li><Link href="#" className="hover:text-violet-600">About</Link></li>
                <li><Link href="#" className="hover:text-violet-600">Blog</Link></li>
                <li><Link href="#" className="hover:text-violet-600">Careers</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <li><Link href="#" className="hover:text-violet-600">Privacy</Link></li>
                <li><Link href="#" className="hover:text-violet-600">Terms</Link></li>
                <li><Link href="#" className="hover:text-violet-600">Security</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-8 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} AMT SaaS. All rights reserved.
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
