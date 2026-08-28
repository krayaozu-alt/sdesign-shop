-- Identifiant lisible pour l'URL publique d'une session.
-- La table est vide au moment de cette migration : la colonne peut donc etre
-- ajoutee directement en NOT NULL sans valeur de repli.
ALTER TABLE "course_sessions" ADD COLUMN "slug" TEXT NOT NULL;

CREATE UNIQUE INDEX "course_sessions_slug_key" ON "course_sessions"("slug");
