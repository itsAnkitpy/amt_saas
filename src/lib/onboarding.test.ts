import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { slugify, isReservedSlug, slugCandidate, destinationForUser } =
    require("./onboarding.ts") as typeof import("./onboarding");

test("slugify lowercases and hyphenates", () => {
    assert.equal(slugify("Acme Inc."), "acme-inc");
    assert.equal(slugify("  Hello World!  "), "hello-world");
    assert.equal(slugify("MyCompany"), "mycompany");
    assert.equal(slugify("Café & Bar"), "caf-bar");
});

test("slugify returns empty for names with no usable characters", () => {
    assert.equal(slugify("!!!"), "");
    assert.equal(slugify("   "), "");
});

test("slugify caps length at 50 characters", () => {
    assert.equal(slugify("a".repeat(60)).length, 50);
});

test("isReservedSlug blocks route-colliding names only", () => {
    assert.equal(isReservedSlug("admin"), true);
    assert.equal(isReservedSlug("api"), true);
    assert.equal(isReservedSlug("onboarding"), true);
    assert.equal(isReservedSlug("acme"), false);
});

test("slugCandidate appends -2, -3, … past the base", () => {
    assert.equal(slugCandidate("acme", 0), "acme");
    assert.equal(slugCandidate("acme", 1), "acme-2");
    assert.equal(slugCandidate("acme", 2), "acme-3");
});

test("destinationForUser routes each user to the right home", () => {
    // fresh signup — no DB row yet
    assert.equal(destinationForUser(null), "/onboarding");
    // superadmin
    assert.equal(
        destinationForUser({ isSuperAdmin: true, tenant: null }),
        "/admin"
    );
    // signed in but abandoned onboarding (no tenant)
    assert.equal(
        destinationForUser({ isSuperAdmin: false, tenant: null }),
        "/onboarding"
    );
    // invited / provisioned user with a workspace → skips onboarding
    assert.equal(
        destinationForUser({ isSuperAdmin: false, tenant: { slug: "acme" } }),
        "/t/acme/dashboard"
    );
});
