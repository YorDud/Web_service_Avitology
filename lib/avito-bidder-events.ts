import { prisma } from "@/lib/prisma";

const BIDDER_EVENTS_RETENTION_DAYS = 2;

function getBidderEventsCutoffDate() {
  return new Date(
    Date.now() - BIDDER_EVENTS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
}

export async function cleanupOldBidderEvents() {
  return prisma.avitoBidderEvent.deleteMany({
    where: {
      createdAt: {
        lt: getBidderEventsCutoffDate(),
      },
    },
  });
}

export async function createBidderEvent(params: {
  bidderId: number;
  type: string;
  message: string;
}) {
  await cleanupOldBidderEvents();

  return prisma.avitoBidderEvent.create({
    data: {
      bidderId: params.bidderId,
      type: params.type,
      message: params.message,
    },
  });
}