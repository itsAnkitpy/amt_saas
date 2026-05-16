import type { ReactElement } from "react";
import { render } from "@react-email/render";
import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { env } from "@/lib/env";

/**
 * Outbound email transport (Module 10 M3).
 *
 *   - `mailpit`  -> nodemailer SMTP (local dev; UI at http://localhost:8025)
 *   - `resend`   -> Resend HTTP API (staging + prod)
 *
 * `EMAIL_OVERRIDE_TO` collapses every recipient list to that one address.
 * Used in staging so the digest cron can run end-to-end without paging real
 * users. Template body still carries the *intended* recipient identity, so
 * audit reviewers can verify routing was correct.
 *
 * Errors throw. The digest loop catches per-user so a single failure does
 * not abort the run (PRD §15).
 */

export type SendEmailInput = {
    to: string | string[];
    subject: string;
    react: ReactElement;
};

/**
 * Staging safety net. When `EMAIL_OVERRIDE_TO` is set, every recipient list
 * collapses to that single address regardless of what the caller passed.
 */
export function applyOverrideGuard(to: string | string[]): string[] {
    if (env.EMAIL_OVERRIDE_TO) {
        return [env.EMAIL_OVERRIDE_TO];
    }
    return Array.isArray(to) ? to : [to];
}

let mailpitTransporter: Transporter | null = null;
function getMailpitTransporter(): Transporter {
    if (mailpitTransporter) return mailpitTransporter;
    // Non-null asserts safe: env.ts .superRefine enforces these when MAIL_TRANSPORT=mailpit.
    mailpitTransporter = nodemailer.createTransport({
        host: env.SMTP_HOST!,
        port: env.SMTP_PORT!,
        secure: false,
    });
    return mailpitTransporter;
}

let resendClient: Resend | null = null;
function getResendClient(): Resend {
    if (resendClient) return resendClient;
    // Non-null assert safe: env.ts .superRefine enforces RESEND_API_KEY when MAIL_TRANSPORT=resend.
    resendClient = new Resend(env.RESEND_API_KEY!);
    return resendClient;
}

type RenderedSend = {
    to: string[];
    subject: string;
    html: string;
    text: string;
};

async function sendViaMailpit(payload: RenderedSend): Promise<void> {
    const transporter = getMailpitTransporter();
    await transporter.sendMail({
        from: env.MAIL_FROM,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
    });
}

async function sendViaResend(payload: RenderedSend): Promise<void> {
    const client = getResendClient();
    const { error } = await client.emails.send({
        from: env.MAIL_FROM,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
    });
    if (error) {
        throw new Error(
            `Resend send failed: ${error.message ?? error.name ?? "unknown error"}`,
        );
    }
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
    const to = applyOverrideGuard(input.to);
    if (to.length === 0) {
        // Caller bug — but throwing is louder than silently skipping.
        throw new Error("sendEmail: recipient list is empty after override guard");
    }

    const html = await render(input.react);
    const text = await render(input.react, { plainText: true });
    const payload: RenderedSend = { to, subject: input.subject, html, text };

    if (env.MAIL_TRANSPORT === "mailpit") {
        return sendViaMailpit(payload);
    }
    if (env.MAIL_TRANSPORT === "resend") {
        return sendViaResend(payload);
    }
    // Unreachable: env.ts enum guarantees one of the two values.
    throw new Error(`Unknown MAIL_TRANSPORT: ${env.MAIL_TRANSPORT as string}`);
}
