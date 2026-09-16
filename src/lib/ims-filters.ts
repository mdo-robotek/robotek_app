export const normalizeFilterKey = (value: string | undefined | null) =>
  (value ?? "").trim().toLowerCase();

/** Collapse punctuation/spaces so "RBK Fury" matches "RBK FURY" and "RBK-FURY". */
export const compactSearchText = (value: string | undefined | null) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Strict exact match — "ANS DC" does NOT match "ANS DC W". */
export const matchesExactFilterValue = (
  value: string | undefined | null,
  allowed: string[]
) => {
  if (allowed.length === 0) return true;
  const normalized = normalizeFilterKey(value);
  const allowedSet = new Set(allowed.map(normalizeFilterKey));
  return allowedSet.has(normalized);
};

export const matchesCategoryItemFilters = (
  item: { category?: string; item_name?: string },
  categoryFilters: string[],
  itemNameFilters: string[]
) => {
  if (!matchesExactFilterValue(item.category, categoryFilters)) return false;
  if (!matchesExactFilterValue(item.item_name, itemNameFilters)) return false;
  return true;
};

/** Type-ahead in the dropdown — every typed word must appear in the item name. */
export const matchesOptionSearch = (label: string, searchTerm: string) => {
  const term = compactSearchText(searchTerm);
  if (!term) return true;
  const hay = compactSearchText(label);
  if (hay.includes(term)) return true;
  const tokens = term.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => hay.includes(t));
};

export type ActiveStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export const matchesActiveFilter = (
  status: string | undefined | null,
  filter: ActiveStatusFilter
) => {
  if (filter === "ALL") return true;
  const n = (status || "").trim().toLowerCase();
  if (filter === "ACTIVE") return n === "active";
  return n === "inactive";
};