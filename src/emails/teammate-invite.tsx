import type { ReactElement } from "react";
import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
} from "@react-email/components";

/**
 * Teammate invitation email (PRD 12 / D5 hybrid).
 *
 * Clerk creates the invitation but does NOT send it (`notify: false`); we send
 * this email ourselves through the app's transport (Mailpit locally, Resend in
 * prod), so it is catchable in local dev and brandable. `acceptUrl` is Clerk's
 * own one-time ticket link, so clicking it drives the normal accept → sign-up →
 * claim-at-login flow.
 */

export type TeammateInviteProps = {
    tenantName: string;
    /** Clerk's ticket-accept URL (from createInvitation's `url`). */
    acceptUrl: string;
    roleLabel: string;
    expiresInDays: number;
    recipientEmail: string;
};

const styles = {
    body: {
        backgroundColor: "#f4f5f7",
        fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        margin: 0,
        padding: "24px 0",
    },
    container: {
        backgroundColor: "#ffffff",
        margin: "0 auto",
        padding: "32px",
        maxWidth: "560px",
        borderRadius: "8px",
    },
    h1: { fontSize: "20px", fontWeight: 600, margin: "0 0 4px 0", color: "#111827" },
    intro: { fontSize: "14px", color: "#111827", margin: "16px 0" },
    muted: { fontSize: "13px", color: "#6b7280", margin: "16px 0 0 0" },
    button: {
        backgroundColor: "#7c3aed",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: 600,
        textDecoration: "none",
        padding: "11px 22px",
        borderRadius: "6px",
        display: "inline-block",
    },
    audit: { fontSize: "11px", color: "#9ca3af", marginTop: "16px" },
    hr: { borderColor: "#e5e7eb", margin: "24px 0 16px 0" },
} as const;

export function TeammateInvite({
    tenantName,
    acceptUrl,
    roleLabel,
    expiresInDays,
    recipientEmail,
}: TeammateInviteProps) {
    return (
        <Html>
            <Head />
            <Preview>You&apos;re invited to join {tenantName}</Preview>
            <Body style={styles.body}>
                <Container style={styles.container}>
                    <Heading as="h1" style={styles.h1}>
                        You&apos;re invited to {tenantName}
                    </Heading>
                    <Text style={styles.intro}>
                        You&apos;ve been invited to join {tenantName} as a {roleLabel}.
                        Click below to accept and set your password.
                    </Text>
                    <Section style={{ margin: "24px 0" }}>
                        <Button href={acceptUrl} style={styles.button}>
                            Accept invitation
                        </Button>
                    </Section>
                    <Text style={styles.muted}>
                        This invitation expires in {expiresInDays} days. If you weren&apos;t
                        expecting it, you can safely ignore this email.
                    </Text>
                    <Hr style={styles.hr} />
                    <Text style={styles.audit}>Sent to {recipientEmail}</Text>
                </Container>
            </Body>
        </Html>
    );
}

/** Thin factory so callers in .ts modules can build the element without JSX. */
export function inviteEmail(props: TeammateInviteProps): ReactElement {
    return <TeammateInvite {...props} />;
}

export default TeammateInvite;
