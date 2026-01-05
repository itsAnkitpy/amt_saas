import { redirect } from "next/navigation";

/**
 * Sign Up page is disabled.
 * Users are created by SuperAdmin/Tenant Admin via invite.
 * Redirect to sign-in page.
 */
export default function SignUpPage() {
    redirect("/sign-in");
}
