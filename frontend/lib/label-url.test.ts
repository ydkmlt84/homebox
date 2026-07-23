import { describe, expect, it } from "vitest";
import { buildLabelURL } from "./label-url";

describe("buildLabelURL", () => {
  const itemURL = "https://homebox.example.com/item/123?view=details";

  it("returns the item URL when the shortcut name is blank", () => {
    expect(buildLabelURL(itemURL, "  ")).toBe(itemURL);
  });

  it("passes the item URL as text input to the named shortcut", () => {
    expect(buildLabelURL(itemURL, "Open Homebox")).toBe(
      "shortcuts://run-shortcut?name=Open+Homebox&input=text&text=https%3A%2F%2Fhomebox.example.com%2Fitem%2F123%3Fview%3Ddetails"
    );
  });
});
