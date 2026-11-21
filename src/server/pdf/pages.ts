import { z } from "zod";

/** A page selection the person typed, such as "1,3,5-7", as 1-based page numbers. */
export function parsePageList(text: string, pageCount: number): number[] {
  const pages: number[] = [];
  for (const part of text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) throw new PdfInputError(`"${part}" is not a page or range`);
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    checkRange(from, to, pageCount);
    for (let page = from; page <= to; page++) pages.push(page);
  }
  if (pages.length === 0) throw new PdfInputError("Choose at least one page");
  return pages;
}

export function checkRange(from: number, to: number, pageCount: number): void {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 1 ||
    to < from
  ) {
    throw new PdfInputError(`${from}-${to} is not a valid range`);
  }
  if (to > pageCount) {
    throw new PdfInputError(
      `Pages ${from}-${to} are outside this document, which has ${pageCount} pages`,
    );
  }
}

/** A message the person can act on: bad options or an unreadable document. */
export class PdfInputError extends Error {}

export const splitOptions = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("ranges"),
    ranges: z
      .array(z.object({ from: z.number().int(), to: z.number().int() }))
      .min(1, "Add at least one range")
      .max(100),
    mergeRanges: z.boolean().default(false),
  }),
  z.object({ mode: z.literal("fixed"), every: z.number().int().min(1) }),
  z.object({
    mode: z.literal("extract"),
    pages: z.string().trim().min(1, "Choose the pages to extract"),
  }),
]);
export type SplitOptions = z.infer<typeof splitOptions>;

/** The page groups a split makes, as 1-based page numbers; one group per output file. */
export function splitGroups(
  options: SplitOptions,
  pageCount: number,
): number[][] {
  const span = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);
  switch (options.mode) {
    case "ranges": {
      const groups = options.ranges.map(({ from, to }) => {
        checkRange(from, to, pageCount);
        return span(from, to);
      });
      return options.mergeRanges ? [groups.flat()] : groups;
    }
    case "fixed": {
      const groups: number[][] = [];
      for (let from = 1; from <= pageCount; from += options.every) {
        groups.push(span(from, Math.min(from + options.every - 1, pageCount)));
      }
      return groups;
    }
    case "extract": {
      const pages =
        options.pages === "all"
          ? span(1, pageCount)
          : parsePageList(options.pages, pageCount);
      return pages.map((page) => [page]);
    }
  }
}
