import { describe, expect, it } from "vitest";

import { readFormString, readOptionalFormString } from "./forms";

describe("form helpers", () => {
  it("returns string values from FormData", () => {
    const form = new FormData();
    form.set("name", "  Unique Hope  ");

    expect(readFormString(form, "name")).toBe("  Unique Hope  ");
  });

  it("returns an empty string for file values", () => {
    const form = new FormData();
    form.set("avatar", new File(["demo"], "demo.txt"));

    expect(readFormString(form, "avatar")).toBe("");
  });

  it("returns undefined for blank optional values", () => {
    const form = new FormData();
    form.set("email", "   ");

    expect(readOptionalFormString(form, "email")).toBeUndefined();
  });
});
