
import * as XLSX from "xlsx";
import path from "path";
import fs from "node:fs";

export interface SqlEntry {
  category: string;
  type: string;
  keyword: string;
  description: string;
  example: string;
}

export function getSqlReference(): SqlEntry[] {
  const filePath = path.join(
    process.cwd(),
    "data",
    "postgresql_sql_reference.xlsx"
  );

  const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: "buffer" });

  const entries: SqlEntry[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      sheet,
      { defval: "" }
    );

    for (const row of rows) {
      entries.push({
        category: String(row["Category"] ?? ""),
        type: String(row["Type"] ?? ""),
        keyword: String(row["Keyword / Function"] ?? ""),
        description: String(row["What it does"] ?? ""),
        example: String(row["Example"] ?? ""),
      });
    }
  }

  return entries;
}

export function searchSqlReference(
  query: string,
  limit = 8
): SqlEntry[] {
  const entries = getSqlReference();

  const terms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 1);

  const normalizedQuery = query.toLowerCase().trim();

  const scored = entries.map((entry) => {
    const keyword = entry.keyword.toLowerCase();
    const category = entry.category.toLowerCase();
    const description = entry.description.toLowerCase();
    const example = entry.example.toLowerCase();
    const type = entry.type.toLowerCase();

    let score = 0;

    // Exact keyword match
    if (keyword === normalizedQuery) score += 20;

    // Keyword phrase match
    if (keyword.includes(normalizedQuery)) score += 12;

    // Search across all fields
    for (const term of terms) {
      if (keyword.includes(term)) score += 6;
      if (description.includes(term)) score += 3;
      if (category.includes(term)) score += 2;
      if (example.includes(term)) score += 1;
      if (type.includes(term)) score += 1;
    }

    return { entry, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}
