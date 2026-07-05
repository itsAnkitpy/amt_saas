"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/onboarding";
import { checkSlugAvailabilityAction, createWorkspaceAction } from "./actions";

/** Light normalization while typing — the server's slugify does the final pass. */
function normalizeSlugInput(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

type Availability =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "available"; slug: string }
    | { status: "taken" };

export function OnboardingForm() {
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [availability, setAvailability] = useState<Availability>({ status: "idle" });
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Latest-request guard so a slow earlier check can't overwrite a newer one.
    const checkSeq = useRef(0);

    // Debounced live availability check, kicked off from the change handlers so
    // no setState runs synchronously inside an effect body.
    const scheduleAvailabilityCheck = (nextSlug: string) => {
        const trimmed = slugify(nextSlug);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        if (!trimmed) {
            setAvailability({ status: "idle" });
            return;
        }

        const seq = ++checkSeq.current;
        setAvailability({ status: "checking" });
        timerRef.current = setTimeout(async () => {
            const result = await checkSlugAvailabilityAction(trimmed);
            if (seq !== checkSeq.current) {
                return; // a newer keystroke superseded this check
            }
            setAvailability(
                result.available
                    ? { status: "available", slug: result.slug }
                    : { status: "taken" }
            );
        }, 400);
    };

    // Clear a pending timer on unmount (no setState here — cleanup only).
    useEffect(() => () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    }, []);

    const handleNameChange = (value: string) => {
        setName(value);
        if (!slugTouched) {
            const next = slugify(value);
            setSlug(next);
            scheduleAvailabilityCheck(next);
        }
    };

    const handleSlugChange = (value: string) => {
        setSlugTouched(true);
        const next = normalizeSlugInput(value);
        setSlug(next);
        scheduleAvailabilityCheck(next);
    };

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        setError(null);

        const result = await createWorkspaceAction(formData);
        // On success the action redirects (throws), so we only get here on error.
        if (result?.error) {
            setError(result.error);
            setIsSubmitting(false);
        }
    };

    return (
        <form action={handleSubmit} className="mt-8 space-y-6">
            {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/40">
                    {error}
                </div>
            )}

            <div className="space-y-1">
                <Label htmlFor="name">Company name *</Label>
                <Input
                    id="name"
                    name="name"
                    autoComplete="organization"
                    placeholder="e.g., Acme Inc."
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                />
            </div>

            <div className="space-y-1">
                <Label htmlFor="slug">Workspace address</Label>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">/t/</span>
                    <Input
                        id="slug"
                        name="slug"
                        autoComplete="off"
                        placeholder="acme"
                        value={slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                    />
                </div>
                <p className="min-h-5 text-xs">
                    {availability.status === "checking" && (
                        <span className="text-muted-foreground">Checking availability…</span>
                    )}
                    {availability.status === "available" && (
                        <span className="text-emerald-600">
                            ✓ /t/{availability.slug} is available
                        </span>
                    )}
                    {availability.status === "taken" && (
                        <span className="text-red-600">
                            ✗ That address is taken or reserved — try another
                        </span>
                    )}
                </p>
            </div>

            <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || availability.status === "taken"}
            >
                {isSubmitting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Create workspace
            </Button>
        </form>
    );
}
