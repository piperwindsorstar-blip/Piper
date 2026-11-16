import { HOME_BASE } from './home-base.ts'
import { TRAVEL_BANDS } from '../piper/rules.ts'

/**
 * Travel only, without the second-venue fee. The terms carry that fee as its own clause.
 * It names the town, not the street: the terms and the bot guide are public.
 */
export const TRAVEL_COPY = `One-way driving distance from Brantford. ${TRAVEL_BANDS}`

/** How the terms read while they still named the home street (before Oct 2026). */
export const STREET_TRAVEL_COPY = `One-way driving distance from ${HOME_BASE}, Brantford. ${TRAVEL_BANDS}`

/** Desk copy. The street stays off the public pages. */
export const DESK_TRAVEL_COPY = `${TRAVEL_COPY} A separate ceremony venue is $75. A third venue is not offered.`
