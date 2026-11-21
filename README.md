# PDF Toolbox

A private PDF workspace for your team: upload PDFs and images, then merge, split, reorder, rotate, compress, watermark and number them, or convert between images and PDF. Every file is deleted two hours after it's made.

Inspired by https://ilovepdf.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Upload PDFs, JPGs and PNGs by dragging or choosing them, then sort, download or delete your own files.
- Merge two or more PDFs in the order you set.
- Split a PDF by custom ranges or every N pages, or extract all or chosen pages.
- See page thumbnails and reorder, rotate, delete or insert blank pages.
- Compress a PDF and see how much smaller it got.
- Stamp a text or image watermark at a position or tiled, over or under the content.
- Add page numbers with position, margin, first number, range, cover page and text.
- Turn JPG and PNG images into a PDF, or each page of a PDF into a JPG.

Left out: accounts and sign-in, which your Gateway handles; Office and HTML conversions; editing, signing, redacting and OCR; password protection; AI tools; cloud-drive pickers and saved workflows; desktop and mobile apps; plans and billing.

## Setup

- Install: `pnpm install`
- Run locally: `pnpm dev`
- Test: `pnpm test` (unit), and the release checks in `checks/` run against a packaged release.
- Deploy: `pnpm run deploy`, or install the release from your Gateway.

There are no secrets or settings. The app uses a D1 database and an R2 bucket, which the deploy creates; R2 must be enabled on the Cloudflare account once.

## Limitations

- Files are deleted two hours after they're uploaded or made; a cleanup runs every ten minutes.
- Each file can be up to 50 MB, and very large PDFs can exceed a Worker's memory or CPU time.
- Password-protected PDFs can't be opened.
- Compression repacks the PDF and drops unused data and metadata; it doesn't resample images.
- PDF to JPG renders pages in your browser, so it needs the tab to stay open until it finishes.
- Watermarks and page numbers use a built-in Latin font; other characters show as "?".
