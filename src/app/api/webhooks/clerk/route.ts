import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
        console.error("Missing CLERK_WEBHOOK_SECRET environment variable");
        return new Response("Server configuration error", { status: 500 });
    }

    // Get the headers
    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response("Missing svix headers", { status: 400 });
    }

    // Get the body
    const payload = await req.json();
    const body = JSON.stringify(payload);

    // Create a new Svix instance with your secret
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: WebhookEvent;

    // Verify the payload with the headers
    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        }) as WebhookEvent;
    } catch (err) {
        console.error("Webhook verification failed:", err);
        return new Response("Webhook verification failed", { status: 400 });
    }

    // Handle the webhook event
    const eventType = evt.type;

    console.log(`Received webhook: ${eventType}`);

    try {
        switch (eventType) {
            case "user.created": {
                const { id, email_addresses, first_name, last_name } = evt.data;
                const primaryEmail = email_addresses?.[0]?.email_address;

                if (!primaryEmail) {
                    console.error("No email address found for user:", id);
                    return new Response("No email address", { status: 400 });
                }

                // Create user in our database
                await db.user.create({
                    data: {
                        id: id, // Use Clerk's ID as our user ID
                        email: primaryEmail,
                        firstName: first_name || "User",
                        lastName: last_name || null,
                        tenantId: "default", // TODO: Handle tenant assignment in onboarding
                    },
                });

                console.log(`Created user: ${id} (${primaryEmail})`);
                break;
            }

            case "user.updated": {
                const { id, first_name, last_name, email_addresses } = evt.data;
                const primaryEmail = email_addresses?.[0]?.email_address;

                // Check if user exists before updating (defensive - handles edge case where user.created failed)
                const existingUser = await db.user.findUnique({ where: { id } });

                if (!existingUser) {
                    console.warn(`user.updated webhook for non-existent user: ${id}. Skipping update.`);
                    return new Response("User not found, skipping update", { status: 200 });
                }

                // Update user in our database
                await db.user.update({
                    where: { id: id },
                    data: {
                        firstName: first_name || "User",
                        lastName: last_name || null,
                        ...(primaryEmail && { email: primaryEmail }),
                    },
                });

                console.log(`Updated user: ${id}`);
                break;
            }

            case "user.deleted": {
                const { id } = evt.data;

                if (id) {
                    // Delete user from our database
                    await db.user.delete({
                        where: { id: id },
                    });

                    console.log(`Deleted user: ${id}`);
                }
                break;
            }

            default:
                console.log(`Unhandled event type: ${eventType}`);
        }

        return new Response("Webhook processed successfully", { status: 200 });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return new Response("Error processing webhook", { status: 500 });
    }
}
