import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BoxIcon,
  CheckCircleIcon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md dark:bg-zinc-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-white">
              <BoxIcon className="h-5 w-5 text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-bold">AMT</span>
          </Link>

          {/* Nav Links - Desktop */}
          <div className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              Features
            </Link>
            <Link href="#pricing" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              Pricing
            </Link>
            <Link href="#about" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              About
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            {userId ? (
              <Link href="/dashboard">
                <Button>
                  <LayoutDashboardIcon className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,rgba(120,119,198,0.1),transparent)]" />

        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="text-center">
            {/* Badge */}
            <Badge variant="secondary" className="mb-4">
              ✨ Trusted by 500+ companies
            </Badge>

            {/* Headline */}
            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-6xl">
              Manage Your Assets
              <span className="block bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Like Never Before
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Track, assign, and optimize your company assets with our powerful SaaS platform.
              From laptops to licenses, manage everything in one place.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="h-12 px-8 text-base">
                  Start Free Trial
                  <ZapIcon className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#demo">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                  Watch Demo
                </Button>
              </Link>
            </div>

            {/* Social Proof */}
            <div className="mt-12 flex items-center justify-center gap-4 text-sm text-zinc-500">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-violet-400 to-indigo-400 dark:border-zinc-900"
                  />
                ))}
              </div>
              <span>Join 2,500+ asset managers</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t bg-zinc-50 py-24 dark:bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Everything you need to manage assets
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-600 dark:text-zinc-400">
              Powerful features designed for modern teams. Simplify your asset management workflow.
            </p>
          </div>

          {/* Features Grid */}
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: BoxIcon,
                title: "Asset Tracking",
                description: "Track all your assets in one place. From hardware to software licenses.",
              },
              {
                icon: UsersIcon,
                title: "Team Management",
                description: "Assign assets to team members. Track who has what, when.",
              },
              {
                icon: ShieldCheckIcon,
                title: "Secure & Compliant",
                description: "Enterprise-grade security. SOC 2 compliant. Your data is safe.",
              },
              {
                icon: ZapIcon,
                title: "Fast & Reliable",
                description: "Lightning fast performance. 99.9% uptime guaranteed.",
              },
              {
                icon: LayoutDashboardIcon,
                title: "Powerful Dashboard",
                description: "Real-time analytics and insights. Make data-driven decisions.",
              },
              {
                icon: CheckCircleIcon,
                title: "Workflow Automation",
                description: "Automate request and approval workflows. Save time.",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative rounded-2xl border bg-white p-8 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-t py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { value: "500+", label: "Companies" },
              { value: "50K+", label: "Assets Tracked" },
              { value: "99.9%", label: "Uptime" },
              { value: "24/7", label: "Support" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-zinc-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-zinc-900 py-24 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to take control of your assets?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Start your free 14-day trial. No credit card required.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="h-12 bg-white px-8 text-zinc-900 hover:bg-zinc-100">
                Get Started Free
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="outline" size="lg" className="h-12 border-zinc-700 px-8 text-white hover:bg-zinc-800">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-white">
                <BoxIcon className="h-5 w-5 text-white dark:text-zinc-900" />
              </div>
              <span className="font-bold">AMT SaaS</span>
            </div>

            {/* Links */}
            <div className="flex gap-6 text-sm text-zinc-600 dark:text-zinc-400">
              <Link href="#" className="hover:text-zinc-900 dark:hover:text-white">Privacy</Link>
              <Link href="#" className="hover:text-zinc-900 dark:hover:text-white">Terms</Link>
              <Link href="#" className="hover:text-zinc-900 dark:hover:text-white">Contact</Link>
            </div>

            {/* Copyright */}
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} AMT SaaS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
