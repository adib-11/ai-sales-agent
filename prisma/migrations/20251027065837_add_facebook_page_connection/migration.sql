-- CreateTable
CREATE TABLE "facebook_page_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "facebook_page_id" TEXT NOT NULL,
    "page_access_token" TEXT NOT NULL,
    "page_name" TEXT NOT NULL,
    "connected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "facebook_page_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "facebook_page_connections_user_id_key" ON "facebook_page_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_page_connections_facebook_page_id_key" ON "facebook_page_connections"("facebook_page_id");

-- CreateIndex
CREATE INDEX "facebook_page_connections_facebook_page_id_idx" ON "facebook_page_connections"("facebook_page_id");
