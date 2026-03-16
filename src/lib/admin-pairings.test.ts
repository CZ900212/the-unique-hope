import { describe, expect, it } from "vitest";

import { clampPage, filterAdminPairings, paginateAdminPairings } from "./admin-pairings";

const pairings = [
  {
    id: "pairing-1",
    student: {
      contact: "",
      name: "Alice Student",
      username: "alice.student",
    },
    teacher: {
      contact: "",
      name: "Teacher One",
      username: "teacher.one",
    },
  },
  {
    id: "pairing-2",
    student: {
      contact: "parent@example.com",
      name: "Bob Student",
      username: "bob.student",
    },
    teacher: {
      contact: "",
      name: "Teacher Two",
      username: "teacher.two",
    },
  },
  {
    id: "pairing-3",
    student: {
      contact: "",
      name: "Carol Student",
      username: "carol.student",
    },
    teacher: {
      contact: "",
      name: "Teacher Three",
      username: "teacher.three",
    },
  },
] as const;

describe("admin pairing helpers", () => {
  it("searches across the full pairing list", () => {
    const filtered = filterAdminPairings(pairings, "teacher three");

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("pairing-3");
  });

  it("matches contact details in the search haystack", () => {
    const filtered = filterAdminPairings(pairings, "parent@example.com");

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("pairing-2");
  });

  it("clamps pagination to the last available page", () => {
    const pagination = paginateAdminPairings(pairings, 5, 2);

    expect(pagination.totalPages).toBe(2);
    expect(pagination.currentPage).toBe(2);
    expect(pagination.pageItems).toHaveLength(1);
    expect(pagination.pageItems[0]?.id).toBe("pairing-3");
  });

  it("clamps standalone page numbers into the available range", () => {
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(4, 3)).toBe(3);
  });
});
