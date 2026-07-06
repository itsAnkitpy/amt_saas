import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import type { Role } from "@/generated/prisma";

const require = createRequire(import.meta.url);
const svc =
    require("./invitation-service.ts") as typeof import("./invitation-service");

// Pure-helper unit tests — no DB, no network. The DB-facing behavior lives in
// invitation-service.integration.test.ts.

test("isInvitableRole rejects SUPER_ADMIN, allows the rest", () => {
    assert.equal(svc.isInvitableRole("SUPER_ADMIN"), false);
    for (const role of ["ADMIN", "MANAGER", "USER"] as const) {
        assert.equal(svc.isInvitableRole(role), true);
    }
});

test("isInvitableRole rejects values that aren't a real role", () => {
    assert.equal(svc.isInvitableRole("OWNER" as Role), false);
    assert.equal(svc.isInvitableRole("" as Role), false);
});

test("isInviteClaimable: only PENDING and not past expiry", () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);

    assert.equal(svc.isInviteClaimable({ status: "PENDING", expiresAt: future }), true);
    assert.equal(svc.isInviteClaimable({ status: "PENDING", expiresAt: past }), false);
    assert.equal(svc.isInviteClaimable({ status: "ACCEPTED", expiresAt: future }), false);
    assert.equal(svc.isInviteClaimable({ status: "REVOKED", expiresAt: future }), false);
    assert.equal(svc.isInviteClaimable({ status: "EXPIRED", expiresAt: future }), false);
});

test("invitationExpiryDate is INVITE_EXPIRY_DAYS ahead of now", () => {
    const now = Date.now();
    const exp = svc.invitationExpiryDate(now);
    const days = Math.round((exp.getTime() - now) / 86_400_000);
    assert.equal(days, svc.INVITE_EXPIRY_DAYS);
});
