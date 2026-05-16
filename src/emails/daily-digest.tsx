import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text,
} from "@react-email/components";
import { format } from "date-fns";

/**
 * Daily digest email (Module 10 M3).
 *
 * Sections are omitted when their list is empty. Footer carries "Manage
 * preferences" so opt-out is always one click away (CAN-SPAM).
 *
 * `recipientEmail` is rendered in the footer so reviewers can verify routing
 * when `EMAIL_OVERRIDE_TO` is active — the To: header is rewritten by the
 * transport, but the body still says who the message was *for*.
 */

export type DigestItem = {
    id: string;
    title: string;
    body: string;
};

export type DigestSections = {
    overdue: DigestItem[];
    dueSoon: DigestItem[];
    warranty: DigestItem[];
    assigned: DigestItem[];
};

export type DailyDigestProps = {
    tenantName: string;
    tenantSlug: string;
    date: Date;
    recipientName: string;
    recipientEmail: string;
    /** Absolute origin without trailing slash, e.g. https://app.example.com */
    baseUrl: string;
    sections: DigestSections;
};

const styles = {
    body: {
        backgroundColor: "#f4f5f7",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
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
    h2: { fontSize: "14px", fontWeight: 600, margin: "24px 0 8px 0", color: "#111827" },
    muted: { fontSize: "13px", color: "#6b7280", margin: "0 0 16px 0" },
    intro: { fontSize: "14px", color: "#111827", margin: "16px 0" },
    itemTitle: { fontSize: "14px", fontWeight: 600, color: "#111827", margin: "0 0 2px 0" },
    itemBody: { fontSize: "13px", color: "#4b5563", margin: "0 0 12px 0" },
    footerLink: { fontSize: "13px", color: "#2563eb", textDecoration: "none" },
    audit: { fontSize: "11px", color: "#9ca3af", marginTop: "16px" },
    hr: { borderColor: "#e5e7eb", margin: "24px 0 16px 0" },
} as const;

function DigestSection({ title, items }: { title: string; items: DigestItem[] }) {
    return (
        <Section>
            <Heading as="h2" style={styles.h2}>
                {title}
            </Heading>
            {items.map((item) => (
                <div key={item.id}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemBody}>{item.body}</Text>
                </div>
            ))}
        </Section>
    );
}

export function DailyDigest(props: DailyDigestProps) {
    const { tenantName, tenantSlug, date, recipientName, recipientEmail, baseUrl, sections } = props;
    const dateLabel = format(date, "MMMM d, yyyy");
    const total =
        sections.overdue.length +
        sections.dueSoon.length +
        sections.warranty.length +
        sections.assigned.length;
    const inboxUrl = `${baseUrl}/t/${tenantSlug}/notifications`;
    const prefsUrl = `${baseUrl}/t/${tenantSlug}/notifications/preferences`;
    const previewText = `${total} unread ${total === 1 ? "notification" : "notifications"} from ${tenantName}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={styles.body}>
                <Container style={styles.container}>
                    <Heading as="h1" style={styles.h1}>
                        {tenantName}
                    </Heading>
                    <Text style={styles.muted}>Daily digest · {dateLabel}</Text>

                    <Text style={styles.intro}>
                        Hi {recipientName}, here {total === 1 ? "is" : "are"} your {total} unread{" "}
                        {total === 1 ? "notification" : "notifications"}.
                    </Text>

                    {sections.overdue.length > 0 && (
                        <DigestSection title="🔴 Maintenance overdue" items={sections.overdue} />
                    )}
                    {sections.dueSoon.length > 0 && (
                        <DigestSection title="🟡 Maintenance due soon" items={sections.dueSoon} />
                    )}
                    {sections.warranty.length > 0 && (
                        <DigestSection title="📅 Warranty expiring" items={sections.warranty} />
                    )}
                    {sections.assigned.length > 0 && (
                        <DigestSection title="👤 Recently assigned to you" items={sections.assigned} />
                    )}

                    <Hr style={styles.hr} />
                    <Text style={styles.muted}>
                        <Link href={inboxUrl} style={styles.footerLink}>
                            View inbox
                        </Link>
                        {" · "}
                        <Link href={prefsUrl} style={styles.footerLink}>
                            Manage preferences
                        </Link>
                    </Text>
                    <Text style={styles.audit}>
                        Sent to {recipientName} &lt;{recipientEmail}&gt;
                    </Text>
                </Container>
            </Body>
        </Html>
    );
}

export default DailyDigest;
