export function readFormString(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function readOptionalFormString(form: FormData, key: string) {
  const value = readFormString(form, key).trim();
  return value.length > 0 ? value : undefined;
}
