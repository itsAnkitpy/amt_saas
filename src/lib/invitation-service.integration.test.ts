import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createRequire } from "node:module";
import type { InvitationTransport } from "./invitation-service";
import type { Role } from "@/generated/prisma";

const require = createRequire(import.meta.url);
const { db } = require("./db.ts") as typeof import("./db");
const svc =
    require("./invitation-service.ts") as typeof import("./invitation-service");

// Integration tests for the invitation engine against a real Postgres DB. Clerk
// is stubbed with a fake transport, so these exercise our own DB logic only:
// dedupe, the singular-membership block, role ceiling, claim-into-correct-tenant,
// revoke scope, expiry, and the multi-invite disambiguation.

const RUN_ID = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Records Clerk calls and hands back deterministic ids — no network. */
function fakeTransport() {
    const sent: Array<{ email: string; tenantId: string }> = [];
    const revoked: string[] = [];
    let n = 0;
    const transport: InvitationTransport = {
        async send({ email, tenantId }) {
            sent.push({ email, tenantId });
            return { id: `${RUN_ID}-clerk-${++n}` };
        },
        async revoke(id) {
            revoked.push(id);
        },
    };
    return { transport, sent, revoked };
}

function makeTenant(suffix: string) {
    return db.tenant.create({
        data: {
            name: `Acme ${RUN_ID} ${suffix}`,
            slug: `${RUN_ID}-${suffix}`,
            plan: "FREE",
        },
    });
}

const email = (suffix: string) => `${suffix}-${RUN_ID}@test.local`;

after(async () => {
    // Deleting tenants cascades their invitations + users; the deleteMany calls
    // sweep any stragglers created directly (claimed users, raw invites).
    await db.invitation.deleteMany({ where: { email: { contains: RUN_ID } } });
    await db.user.deleteMany({ where: { id: { startsWith: RUN_ID } } });
    await db.tenant.deleteMany({ where: { slug: { startsWith: RUN_ID } } });
    await db.$disconnect();
});

test("inviteToTenant writes exactly one PENDING row and sends one email", async () => {
    const tenant = await makeTenant("one");
    const { transport, sent } = fakeTransport();

    const res = await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("one"), role: "USER", invitedById: "inviter-x" },
        transport
    );

    assert.equal(res.ok, true);
    assert.equal(sent.length, 1);
    const rows = await db.invitation.findMany({
        where: { tenantId: tenant.id, status: "PENDING" },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, email("one"));
    assert.equal(rows[0].role, "USER");
    assert.ok(rows[0].clerkInvitationId);
});

test("re-inviting the same email + tenant reuses the pending row (no duplicate, no 2nd email)", async () => {
    const tenant = await makeTenant("dup");
    const { transport, sent } = fakeTransport();
    const input = {
        tenantId: tenant.id,
        email: email("dup"),
        role: "MANAGER" as const,
        invitedById: "inviter-x",
    };

    const first = await svc.inviteToTenant(input, transport);
    const second = await svc.inviteToTenant(input, transport);

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(sent.length, 1, "second invite must not send another email");
    const rows = await db.invitation.findMany({
        where: { tenantId: tenant.id, email: email("dup"), status: "PENDING" },
    });
    assert.equal(rows.length, 1);
});

test("claim creates the user in the inviting tenant with the invited role, marks ACCEPTED", async () => {
    const tenant = await makeTenant("claim");
    const { transport } = fakeTransport();
    await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("claim"), role: "MANAGER", invitedById: "inviter-x" },
        transport
    );

    const result = await svc.claimInvitationForUser({
        clerkUserId: `${RUN_ID}-claimer`,
        email: email("claim"),
        firstName: "Grace",
        lastName: "Hopper",
    });

    assert.deepEqual(result, { claimed: true, tenantSlug: tenant.slug });
    const user = await db.user.findUnique({ where: { id: `${RUN_ID}-claimer` } });
    assert.equal(user?.tenantId, tenant.id);
    assert.equal(user?.role, "MANAGER");
    const invite = await db.invitation.findFirst({
        where: { tenantId: tenant.id, email: email("claim") },
    });
    assert.equal(invite?.status, "ACCEPTED");
    assert.ok(invite?.acceptedAt);
});

test("claim is idempotent — a second call returns the same workspace, one user row", async () => {
    const tenant = await makeTenant("idem");
    const { transport } = fakeTransport();
    await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("idem"), role: "USER", invitedById: "inviter-x" },
        transport
    );
    const claim = () =>
        svc.claimInvitationForUser({
            clerkUserId: `${RUN_ID}-idem`,
            email: email("idem"),
            firstName: "Ada",
        });

    const first = await claim();
    const second = await claim();

    assert.deepEqual(first, { claimed: true, tenantSlug: tenant.slug });
    assert.deepEqual(second, { claimed: true, tenantSlug: tenant.slug });
    const users = await db.user.findMany({ where: { id: `${RUN_ID}-idem` } });
    assert.equal(users.length, 1);
});

test("cannot grant SUPER_ADMIN", async () => {
    const tenant = await makeTenant("super");
    const { transport, sent } = fakeTransport();

    const res = await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("super"), role: "SUPER_ADMIN", invitedById: "inviter-x" },
        transport
    );

    assert.equal(res.ok, false);
    assert.equal(sent.length, 0);
    const rows = await db.invitation.findMany({ where: { tenantId: tenant.id } });
    assert.equal(rows.length, 0);
});

test("an unknown role is rejected before any email is sent", async () => {
    const tenant = await makeTenant("badrole");
    const { transport, sent } = fakeTransport();

    const res = await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("badrole"), role: "OWNER" as Role, invitedById: "inviter-x" },
        transport
    );

    assert.equal(res.ok, false);
    assert.equal(sent.length, 0);
    const rows = await db.invitation.findMany({ where: { tenantId: tenant.id } });
    assert.equal(rows.length, 0);
});

test("re-invite with a different role updates the pending invite, no second email", async () => {
    const tenant = await makeTenant("rerole");
    const { transport, sent } = fakeTransport();
    const base = { tenantId: tenant.id, email: email("rerole"), invitedById: "inviter-x" };

    const first = await svc.inviteToTenant({ ...base, role: "USER" }, transport);
    const second = await svc.inviteToTenant({ ...base, role: "MANAGER" }, transport);

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(sent.length, 1, "reuse must not send a second email");
    const rows = await db.invitation.findMany({
        where: { tenantId: tenant.id, email: email("rerole"), status: "PENDING" },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].role, "MANAGER");
});

test("inviting an email that already belongs to a tenant is rejected", async () => {
    const tenant = await makeTenant("member");
    await db.user.create({
        data: {
            id: `${RUN_ID}-existing`,
            email: email("member"),
            firstName: "Existing",
            role: "USER",
            tenantId: tenant.id,
        },
    });
    const { transport, sent } = fakeTransport();

    const res = await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("member"), role: "USER", invitedById: "inviter-x" },
        transport
    );

    assert.equal(res.ok, false);
    assert.equal(sent.length, 0);
});

test("a revoked invite is not claimable, and revoke calls the Clerk transport", async () => {
    const tenant = await makeTenant("rev");
    const { transport, revoked } = fakeTransport();
    const invited = await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("rev"), role: "USER", invitedById: "inviter-x" },
        transport
    );
    assert.equal(invited.ok, true);
    if (!invited.ok) return;

    const rev = await svc.revokeInvitation(invited.invitation.id, tenant.id, transport);
    assert.deepEqual(rev, { ok: true });
    assert.equal(revoked.length, 1);

    const claim = await svc.claimInvitationForUser({
        clerkUserId: `${RUN_ID}-rev`,
        email: email("rev"),
        firstName: "Nope",
    });
    assert.deepEqual(claim, { claimed: false });
    assert.equal(await db.user.count({ where: { id: `${RUN_ID}-rev` } }), 0);
});

test("revoke is scoped — one tenant cannot revoke another tenant's invite", async () => {
    const tenantA = await makeTenant("scopeA");
    const tenantB = await makeTenant("scopeB");
    const { transport } = fakeTransport();
    const invited = await svc.inviteToTenant(
        { tenantId: tenantA.id, email: email("scope"), role: "USER", invitedById: "inviter-x" },
        transport
    );
    assert.equal(invited.ok, true);
    if (!invited.ok) return;

    const rev = await svc.revokeInvitation(invited.invitation.id, tenantB.id, transport);
    assert.equal(rev.ok, false);
    const stillPending = await db.invitation.findUnique({
        where: { id: invited.invitation.id },
    });
    assert.equal(stillPending?.status, "PENDING");
});

test("an expired invite is not claimable", async () => {
    const tenant = await makeTenant("exp");
    await db.invitation.create({
        data: {
            email: email("exp"),
            tenantId: tenant.id,
            role: "USER",
            status: "PENDING",
            invitedById: "inviter-x",
            expiresAt: new Date(Date.now() - 60_000), // already past
        },
    });

    const claim = await svc.claimInvitationForUser({
        clerkUserId: `${RUN_ID}-exp`,
        email: email("exp"),
        firstName: "Late",
    });

    assert.deepEqual(claim, { claimed: false });
});

test("multi-invite: tenantHint lands the claimer in the hinted workspace", async () => {
    const tenantA = await makeTenant("multiA");
    const tenantB = await makeTenant("multiB");
    const shared = email("multi");
    const { transport } = fakeTransport();
    await svc.inviteToTenant(
        { tenantId: tenantA.id, email: shared, role: "USER", invitedById: "inviter-x" },
        transport
    );
    await svc.inviteToTenant(
        { tenantId: tenantB.id, email: shared, role: "MANAGER", invitedById: "inviter-y" },
        transport
    );

    const claim = await svc.claimInvitationForUser({
        clerkUserId: `${RUN_ID}-multi`,
        email: shared,
        firstName: "Split",
        tenantHint: tenantB.id,
    });

    assert.deepEqual(claim, { claimed: true, tenantSlug: tenantB.slug });
    const user = await db.user.findUnique({ where: { id: `${RUN_ID}-multi` } });
    assert.equal(user?.tenantId, tenantB.id);
    assert.equal(user?.role, "MANAGER");
    // The other tenant's invite stays PENDING (untouched).
    const other = await db.invitation.findFirst({
        where: { tenantId: tenantA.id, email: shared },
    });
    assert.equal(other?.status, "PENDING");
});

test("revoked then re-invited: a fresh PENDING invite is created and claimable", async () => {
    const tenant = await makeTenant("reinv");
    const { transport } = fakeTransport();
    const first = await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("reinv"), role: "USER", invitedById: "inviter-x" },
        transport
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    await svc.revokeInvitation(first.invitation.id, tenant.id, transport);

    const second = await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("reinv"), role: "USER", invitedById: "inviter-x" },
        transport
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.notEqual(second.invitation.id, first.invitation.id);

    const pending = await svc.listPendingInvitations(tenant.id);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, second.invitation.id);
});

test("inviter deleted before acceptance: the invite survives and still claims", async () => {
    const tenant = await makeTenant("gone");
    // A real inviter user we then delete — invitedById has no FK, so the invite
    // must outlive them.
    const inviter = await db.user.create({
        data: {
            id: `${RUN_ID}-inviter-gone`,
            email: email("inviter-gone"),
            firstName: "Boss",
            role: "ADMIN",
            tenantId: tenant.id,
        },
    });
    const { transport } = fakeTransport();
    const invited = await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("gone"), role: "USER", invitedById: inviter.id },
        transport
    );
    assert.equal(invited.ok, true);

    await db.user.delete({ where: { id: inviter.id } });

    const claim = await svc.claimInvitationForUser({
        clerkUserId: `${RUN_ID}-gone-claimer`,
        email: email("gone"),
        firstName: "New",
    });
    assert.deepEqual(claim, { claimed: true, tenantSlug: tenant.slug });
});

test("listPendingInvitations returns only still-valid pending invites", async () => {
    const tenant = await makeTenant("list");
    const { transport } = fakeTransport();
    await svc.inviteToTenant(
        { tenantId: tenant.id, email: email("list-a"), role: "USER", invitedById: "inviter-x" },
        transport
    );
    // An expired one must not show up.
    await db.invitation.create({
        data: {
            email: email("list-b"),
            tenantId: tenant.id,
            role: "USER",
            status: "PENDING",
            invitedById: "inviter-x",
            expiresAt: new Date(Date.now() - 60_000),
        },
    });

    const pending = await svc.listPendingInvitations(tenant.id);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].email, email("list-a"));
});
