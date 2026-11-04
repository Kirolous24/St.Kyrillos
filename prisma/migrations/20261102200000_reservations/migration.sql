-- Van reservations (2026-11-02): the things servants reserve, the reservations,
-- and the servants on each. Additive: three new tables. The church's two vans
-- are added so the page is usable at once; the admin can rename or retire them.

-- CreateTable
CREATE TABLE "ReservationItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "photo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "service" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationServant" (
    "reservationId" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,

    CONSTRAINT "ReservationServant_pkey" PRIMARY KEY ("reservationId","servantId")
);

-- CreateIndex
CREATE INDEX "Reservation_itemId_startsAt_idx" ON "Reservation"("itemId", "startsAt");

-- CreateIndex
CREATE INDEX "Reservation_startsAt_idx" ON "Reservation"("startsAt");

-- CreateIndex
CREATE INDEX "ReservationServant_servantId_idx" ON "ReservationServant"("servantId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ReservationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationServant" ADD CONSTRAINT "ReservationServant_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationServant" ADD CONSTRAINT "ReservationServant_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The church's vans
INSERT INTO "ReservationItem" ("id", "name", "color", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
    ('black-van', 'Black Van', 'black', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('white-van', 'White Van', 'white', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
