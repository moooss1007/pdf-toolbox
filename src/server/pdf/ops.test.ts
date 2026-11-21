import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import * as ops from "./ops";
import { PdfInputError, parsePageList, splitGroups } from "./pages";

async function makePdf(count: number, width = 200) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) doc.addPage([width + i, 300]);
  return { name: "doc.pdf", bytes: await doc.save() };
}

const widths = async (bytes: Uint8Array) =>
  (await PDFDocument.load(bytes))
    .getPages()
    .map((p) => Math.round(p.getWidth()));

describe("page selections", () => {
  it("parses lists and ranges", () => {
    expect(parsePageList("1, 3-5,7", 8)).toEqual([1, 3, 4, 5, 7]);
  });
  it("refuses pages outside the document", () => {
    expect(() => parsePageList("2-9", 5)).toThrow(PdfInputError);
    expect(() => parsePageList("x", 5)).toThrow(PdfInputError);
  });
  it("counts the files a split makes", () => {
    expect(splitGroups({ mode: "fixed", every: 3 }, 7)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
    expect(
      splitGroups(
        {
          mode: "ranges",
          ranges: [
            { from: 1, to: 2 },
            { from: 5, to: 5 },
          ],
          mergeRanges: true,
        },
        5,
      ),
    ).toEqual([[1, 2, 5]]);
    expect(splitGroups({ mode: "extract", pages: "all" }, 3)).toHaveLength(3);
  });
});

describe("tools", () => {
  it("merges in order", async () => {
    const out = await ops.merge([await makePdf(1, 400), await makePdf(2, 100)]);
    expect(await widths(out.bytes)).toEqual([400, 100, 101]);
    await expect(ops.merge([await makePdf(1)])).rejects.toThrow(PdfInputError);
  });

  it("organizes pages, keeping at least one", async () => {
    const input = await makePdf(3);
    const out = await ops.organize(input, {
      pages: [
        { source: 2, rotate: 270 },
        { source: null, rotate: 0 },
      ],
    });
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getRotation().angle).toBe(270);
    await expect(ops.organize(input, { pages: [] })).rejects.toThrow(
      "at least one page",
    );
  });

  it("keeps the original when compressing saves nothing", () => {
    const input = { name: "a.pdf", bytes: new Uint8Array(100) };
    const result = ops.compressResult(input, new Uint8Array(120), 1);
    expect(result.reduced).toBe(false);
    expect(result.output.bytes).toBe(input.bytes);
    expect(result.savedPercent).toBe(0);
    expect(ops.compressResult(input, new Uint8Array(75), 1).savedPercent).toBe(
      25,
    );
  });

  it("labels page numbers", () => {
    const base = {
      vertical: "bottom",
      horizontal: "center",
      margin: "small",
      start: 1,
      skipFirst: false,
      fontSize: 10,
    } as const;
    expect(ops.pageLabel({ ...base, template: "page-n-of-p" }, 3, 10)).toBe(
      "Page 3 of 10",
    );
    expect(
      ops.pageLabel({ ...base, template: "custom", custom: "{n}/{p}" }, 2, 4),
    ).toBe("2/4");
  });

  it("watermarks only the chosen pages", async () => {
    const input = await makePdf(3);
    const out = await ops.watermark(input, {
      type: "text",
      text: "DRAFT",
      fontSize: 30,
      color: "#336699",
      opacity: 0.5,
      rotation: 45,
      position: "tiled",
      from: 2,
      to: 3,
      layer: "under",
    });
    expect(out.pageCount).toBe(3);
    await expect(
      ops.watermark(input, {
        type: "text",
        text: "X",
        fontSize: 30,
        color: "#000000",
        opacity: 1,
        rotation: 0,
        position: "top-left",
        from: 2,
        to: 4,
        layer: "over",
      }),
    ).rejects.toThrow(PdfInputError);
  });

  it("numbers pages after a cover", async () => {
    const out = await ops.addPageNumbers(await makePdf(4), {
      vertical: "top",
      horizontal: "right",
      margin: "large",
      start: 1,
      skipFirst: true,
      template: "n",
      fontSize: 12,
    });
    expect(out.pageCount).toBe(4);
  });
});
