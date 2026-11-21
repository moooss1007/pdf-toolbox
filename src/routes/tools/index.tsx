import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Combine,
  FileImage,
  Hash,
  Images,
  LayoutGrid,
  Minimize2,
  Scissors,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";

export const Route = createFileRoute("/tools/")({
  component: ToolsPage,
});

const TOOLS: { to: string; title: string; text: string; icon: LucideIcon }[] = [
  {
    to: "/tools/merge",
    title: "Merge",
    text: "Join PDFs into one, in the order you choose.",
    icon: Combine,
  },
  {
    to: "/tools/split",
    title: "Split",
    text: "Cut a PDF into ranges or pull out single pages.",
    icon: Scissors,
  },
  {
    to: "/tools/organize",
    title: "Organize pages",
    text: "Reorder, rotate, delete or add blank pages.",
    icon: LayoutGrid,
  },
  {
    to: "/tools/compress",
    title: "Compress",
    text: "Shrink a PDF and see how much it saved.",
    icon: Minimize2,
  },
  {
    to: "/tools/watermark",
    title: "Watermark",
    text: "Stamp text or an image on the pages.",
    icon: Stamp,
  },
  {
    to: "/tools/page-numbers",
    title: "Page numbers",
    text: "Add numbers at the top or bottom of the pages.",
    icon: Hash,
  },
  {
    to: "/tools/images-to-pdf",
    title: "Images to PDF",
    text: "Turn JPGs and PNGs into a PDF.",
    icon: Images,
  },
  {
    to: "/tools/pdf-to-images",
    title: "PDF to JPG",
    text: "Save each page as an image.",
    icon: FileImage,
  },
];

function ToolsPage() {
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Tools" />
      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map(({ to, title, text, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors group-hover:bg-muted">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" aria-hidden />
                  {title}
                </CardTitle>
                <CardDescription>{text}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
