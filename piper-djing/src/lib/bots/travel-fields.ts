import type { BookingView } from '../crm/store.server.ts'

/** Travel as flat fields for bots: distanceKm and travelFee (dollars). */
export function travelFields(booking: Pick<BookingView, 'travel'>) {
  const travel = booking.travel
  return {
    distanceKm: travel?.km ?? null,
    travelFee: travel?.feeCents == null ? null : travel.feeCents / 100,
    travelFeeCents: travel?.feeCents ?? null,
    travelTier: travel?.tier ?? null,
    hotelRequired: travel?.hotel ?? false,
    travelSource: travel?.source ?? '',
  }
}
