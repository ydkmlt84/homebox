export function buildLabelURL(itemURL: string, shortcutName: string): string {
  const name = shortcutName.trim();
  if (!name) {
    return itemURL;
  }

  const params = new URLSearchParams({
    name,
    input: "text",
    text: itemURL,
  });

  return `shortcuts://run-shortcut?${params.toString()}`;
}
