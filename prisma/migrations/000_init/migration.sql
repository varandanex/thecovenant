-- CreateTable
CREATE TABLE IF NOT EXISTS "articles" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "excerpt" TEXT,
  "cover_image_url" TEXT,
  "cover_image_alt" TEXT,
  "category" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "published_at" TIMESTAMP(3),
  "reading_time" TEXT,
  "sections" JSONB NOT NULL,
  "escape_room_general_data" JSONB,
  "escape_room_scoring" JSONB,
  "content_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "articles_slug_key" ON "articles"("slug");

-- CreateTable
CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" TEXT PRIMARY KEY,
  "hero" JSONB NOT NULL,
  "highlight_slug" TEXT,
  "featured_slugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "navigation" JSONB NOT NULL,
  "content_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "article_revisions" (
  "id" TEXT PRIMARY KEY,
  "article_id" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "article_revisions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "article_revisions_article_id_idx" ON "article_revisions"("article_id");

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_articles ON "articles";
CREATE TRIGGER set_timestamp_articles
BEFORE UPDATE ON "articles"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_timestamp_site_settings ON "site_settings";
CREATE TRIGGER set_timestamp_site_settings
BEFORE UPDATE ON "site_settings"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
