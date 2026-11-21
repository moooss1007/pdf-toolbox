import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "pdf-toolbox",
  name: "PDF Toolbox",
  description:
    "Merge, split, reorder, rotate, compress, watermark and number PDFs, and convert between PDFs and images.",
  icon: "/icon.svg",
  resources: {
    d1: ["DB"],
    r2: ["files"],
  },
});
