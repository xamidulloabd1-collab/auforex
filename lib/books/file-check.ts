import "server-only";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getStorage } from "@/lib/storage";

/**
 * Checks that every book's PDF (and cover) exists in storage.
 *
 * The 3 seeded books were copied by `prisma/seed.ts` into a `storage/` folder on the machine that
 * ran the seed — a folder that does not exist inside Vercel functions, so they answered 404.
 * Their originals ship with the deployment (prisma/seed-assets), so a missing seeded file is
 * relinked to that copy when the byte size matches exactly. Anything else is only reported:
 * no content is invented — the admin re-uploads the PDF.
 */
export type BookFileReport = {
  id: string;
  title: string;
  file: "ok" | "relinked" | "missing";
  cover: "ok" | "relinked" | "missing" | "none";
};

async function seededFiles() {
  const root = path.join(/*turbopackIgnore: true*/ process.cwd(), "prisma", "seed-assets");
  const books = await readdir(path.join(root, "books")).catch(() => [] as string[]);
  const covers = new Set(await readdir(path.join(root, "covers")).catch(() => [] as string[]));
  return Promise.all(
    books
      .filter((f) => f.endsWith(".pdf"))
      .map(async (file) => {
        const base = file.replace(/\.pdf$/, "");
        const cover = [...covers].find((c) => c.replace(/\.(webp|png|jpg)$/, "") === base) ?? null;
        return { file, cover, size: (await stat(path.join(root, "books", file))).size };
      }),
  );
}

export async function checkBookFiles(): Promise<BookFileReport[]> {
  const storage = getStorage();
  const seeded = await seededFiles();
  const books = await prisma.book.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, fileKey: true, fileSize: true, coverKey: true },
  });
  const report: BookFileReport[] = [];
  for (const b of books) {
    const match = seeded.find((s) => s.size === b.fileSize) ?? null;
    let file: BookFileReport["file"] = (await storage.stat(b.fileKey)) ? "ok" : "missing";
    let cover: BookFileReport["cover"] = !b.coverKey ? "none" : (await storage.stat(b.coverKey)) ? "ok" : "missing";
    const data: { fileKey?: string; coverKey?: string | null } = {};
    if (file === "missing" && match) {
      data.fileKey = `bundled/books/${match.file}`;
      file = "relinked";
    }
    if (cover === "missing") {
      if (match?.cover) {
        data.coverKey = `bundled/covers/${match.cover}`;
        cover = "relinked";
      }
    } else if (cover === "none" && file === "relinked" && match?.cover) {
      data.coverKey = `bundled/covers/${match.cover}`;
      cover = "relinked";
    }
    if (Object.keys(data).length) await prisma.book.update({ where: { id: b.id }, data });
    report.push({ id: b.id, title: b.title, file, cover });
  }
  return report;
}
