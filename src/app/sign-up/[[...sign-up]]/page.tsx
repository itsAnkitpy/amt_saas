import { SignUp } from "@clerk/nextjs";

/**
 * Public sign-up — the front door for self-serve onboarding.
 * New users land on /onboarding after signing up (NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL).
 */
export default function SignUpPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <SignUp />
        </div>
    );
}
