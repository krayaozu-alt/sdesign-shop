-- Les bannieres adoptent le meme cycle de vie que les publications :
-- BROUILLON | PROGRAMMEE | PUBLIEE | ARCHIVEE, en remplacement du simple
-- booleen isActive. La table est vide : la colonne peut etre remplacee
-- directement, sans reprise de donnees.
DROP INDEX "banners_placement_isActive_idx";

ALTER TABLE "banners" DROP COLUMN "isActive",
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'BROUILLON',
ADD COLUMN "subtitle" TEXT;

-- Prix mis en avant sur une publication.
ALTER TABLE "posts" ADD COLUMN "price" INTEGER;

CREATE INDEX "banners_placement_status_idx" ON "banners"("placement", "status");
CREATE INDEX "banners_endsAt_idx" ON "banners"("endsAt");
