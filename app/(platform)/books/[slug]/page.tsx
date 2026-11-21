import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getBookForViewer } from "@/lib/data/learning";
import { ProAccessGate } from "@/components/subscription/pro-access-gate";
import { PdfReader } from "@/components/books/pdf-reader";

export const metadata: Metadata = { title: "Kitob o‘qish", robots: { index: false } };

export default async function BookReaderPage({ params }: PageProps<"/books/[slug]">) {
  const { slug } = await params;
  const viewer = await requireUser(`/books/${slug}`);
  if (!viewer.hasPremium) {
    return (
      <div className="px-4 py-16 sm:px-6">
        <ProAccessGate />
      </div>
    );
  }
  const data = await getBookForViewer(slug, { userId: viewer.id, isAdmin: viewer.isAdmin });
  if (!data) notFound();

  return (
    <PdfReader
      bookId={data.book.id}
      title={data.book.title}
      initialPage={data.progress?.currentPage ?? 1}
      watermark={viewer.email}
    />
  );
}
