-- Lessons: category ("Texnik tahlil — 5-dars"), level, Free/PRO access and a lesson number that is
-- unique inside each course. Additive only: no table or column is dropped, no lesson is deleted.

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" "ExperienceLevel";

-- Existing lessons take their course's category.
UPDATE "Lesson" AS l
SET "categoryId" = c."categoryId"
FROM "Course" AS c
WHERE l."courseId" = c."id" AND l."categoryId" IS NULL AND c."categoryId" IS NOT NULL;

-- Lesson numbers must be positive and unique per course. Only courses that break this rule are
-- renumbered 1, 2, 3 … in their current order (order, then creation time). Progress rows point to
-- lesson ids, so nobody's progress changes.
WITH needs_fix AS (
  SELECT "courseId"
  FROM "Lesson"
  GROUP BY "courseId"
  HAVING count(*) <> count(DISTINCT "order") OR min("order") < 1
), ranked AS (
  SELECT l."id", row_number() OVER (PARTITION BY l."courseId" ORDER BY l."order", l."createdAt", l."id") AS n
  FROM "Lesson" AS l
  JOIN needs_fix AS f ON f."courseId" = l."courseId"
)
UPDATE "Lesson" AS l
SET "order" = r.n
FROM ranked AS r
WHERE r."id" = l."id";

-- DropIndex (replaced by the unique index below, which serves the same queries)
DROP INDEX "Lesson_courseId_order_idx";

-- CreateIndex
CREATE INDEX "Lesson_categoryId_idx" ON "Lesson"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_courseId_order_key" ON "Lesson"("courseId", "order");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
