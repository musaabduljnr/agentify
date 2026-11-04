import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBusinessNotification } from "@/lib/notifications/service";

const fixtures = vi.hoisted(() => ({
  business: { owner_id: "owner-1" },
  members: [{ user_id: "member-1" }, { user_id: "member-2" }],
  preferences: [
    { user_id: null, in_app_enabled: false },
    { user_id: "member-1", in_app_enabled: true },
  ],
  storedNotifications: [{ id: "notification-owner", user_id: "owner-1" }],
  insertedNotifications: [] as Array<{ id: string; user_id: string; archived_at: string | null }>,
  upsertError: null as { message: string } | null,
  suppressUpsert: false,
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from(table: string) {
      let upsert = false;
      const query: any = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        not: vi.fn(() => query),
        in: vi.fn(() => query),
        upsert: vi.fn((rows: Array<{ user_id: string; archived_at: string | null }>) => {
          upsert = true;
          if (!fixtures.suppressUpsert) {
            fixtures.insertedNotifications = rows.map((row) => ({
              id: `notification-${row.user_id}`,
              user_id: row.user_id,
              archived_at: row.archived_at,
            }));
            fixtures.storedNotifications = fixtures.insertedNotifications;
          }
          return query;
        }),
        maybeSingle: vi.fn(async () => ({ data: fixtures.business, error: null })),
        then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
          let result: unknown;
          if (table === "business_members") result = { data: fixtures.members, error: null };
          else if (table === "notification_preferences") result = { data: fixtures.preferences, error: null };
          else if (table === "notifications" && upsert) {
            result = { data: fixtures.insertedNotifications, error: fixtures.upsertError };
          } else if (table === "notifications") {
            result = { data: fixtures.storedNotifications, error: null };
          } else result = { data: [], error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
  })),
}));

describe("business notifications", () => {
  beforeEach(() => {
    fixtures.business.owner_id = "owner-1";
    fixtures.members = [{ user_id: "member-1" }, { user_id: "member-2" }];
    fixtures.preferences = [
      { user_id: null, in_app_enabled: false },
      { user_id: "member-1", in_app_enabled: true },
    ];
    fixtures.storedNotifications = [{ id: "notification-owner", user_id: "owner-1" }];
    fixtures.insertedNotifications = [];
    fixtures.upsertError = null;
    fixtures.suppressUpsert = false;
  });

  it("uses per-user preferences while notifying active business recipients", async () => {
    const result = await createBusinessNotification({
      businessId: "business-1",
      eventKey: "lead:conversation-1",
      category: "leads",
      title: "New lead",
      message: "A visitor shared contact information.",
      href: "/dashboard/leads",
    });

    expect(fixtures.insertedNotifications.map((row) => row.user_id)).toEqual([
      "owner-1",
      "member-1",
      "member-2",
    ]);
    expect(fixtures.insertedNotifications.find((row) => row.user_id === "owner-1")?.archived_at).not.toBeNull();
    expect(result.ownerNotificationId).toBe("notification-owner-1");
    expect(result.notifications).toHaveLength(3);
  });

  it("returns existing notification IDs when an idempotent retry inserts no rows", async () => {
    fixtures.preferences = [{ user_id: null, in_app_enabled: true }];
    fixtures.insertedNotifications = [];
    fixtures.suppressUpsert = true;

    const result = await createBusinessNotification({
      businessId: "business-1",
      eventKey: "billing-payment:event-1",
      category: "billing",
      title: "Payment received",
      message: "Your subscription is active.",
      href: "/dashboard/billing",
    });

    expect(result.ownerNotificationId).toBe("notification-owner");
  });

  it("deduplicates recipients when the business owner is also an active member", async () => {
    fixtures.members = [{ user_id: "owner-1" }, { user_id: "owner-1" }];
    fixtures.preferences = [{ user_id: null, in_app_enabled: true }];

    await createBusinessNotification({
      businessId: "business-1",
      eventKey: "team-invitation:invite-1",
      category: "team",
      title: "Team invitation sent",
      message: "An invitation was sent.",
      href: "/dashboard/settings/team",
    });

    expect(fixtures.insertedNotifications).toHaveLength(1);
    expect(fixtures.insertedNotifications[0].user_id).toBe("owner-1");
  });

  it("surfaces persistence errors instead of treating notification creation as successful", async () => {
    fixtures.upsertError = { message: "database unavailable" };

    await expect(createBusinessNotification({
      businessId: "business-1",
      eventKey: "lead:conversation-error",
      category: "leads",
      title: "New lead",
      message: "A visitor shared contact information.",
      href: "/dashboard/leads",
    })).rejects.toThrow("Failed to persist notification: database unavailable");
  });
});
