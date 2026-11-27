"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
	ExchangeRateSchema,
	parseStoredItinerary,
	TripInputSchema,
	type ExchangeRate,
	type Itinerary,
	type TripInput,
} from "./itinerary-schema";

// The trip being worked on is passed between pages via sessionStorage (per
// browser tab, cleared when the tab closes). Trips the user saves to keep live
// in localStorage instead: see saved-trips.ts.

const TRIP_KEY = "holiday-maker:trip";
const ITINERARY_KEY = "holiday-maker:itinerary";
// Which saved trip (if any) the current itinerary came from or was saved as.
const SAVED_ID_KEY = "holiday-maker:saved-id";
// The exchange rate shown on the itinerary page, kept until the budget is edited.
const EXCHANGE_KEY = "holiday-maker:exchange";

// Components reading storage re-render when we write to it.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

function write(key: string, value: unknown) {
	try {
		sessionStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage can be unavailable (private mode); the flow just won't persist.
	}
	notify();
}

function remove(key: string) {
	try {
		sessionStorage.removeItem(key);
	} catch {}
}

/** Starts a new trip: clears any previous itinerary. */
export const saveTrip = (trip: TripInput) => {
	remove(ITINERARY_KEY);
	remove(SAVED_ID_KEY);
	remove(EXCHANGE_KEY);
	write(TRIP_KEY, trip);
};
export const saveExchange = (rate: ExchangeRate) => write(EXCHANGE_KEY, rate);
/** Forget the stored rate so the next view fetches a fresh one (after a budget edit). */
export const clearExchange = () => {
	remove(EXCHANGE_KEY);
	notify();
};
/** Updates the current trip's details without clearing its itinerary. */
export const updateTrip = (trip: TripInput) => write(TRIP_KEY, trip);
export const setSavedId = (id: string) => write(SAVED_ID_KEY, id);

/** Opens a saved trip in this tab. */
export const openSavedTrip = (saved: {
	id: string;
	trip: TripInput;
	itinerary: Itinerary;
	exchange?: ExchangeRate | null;
}) => {
	write(TRIP_KEY, saved.trip);
	write(ITINERARY_KEY, saved.itinerary);
	write(SAVED_ID_KEY, saved.id);
	if (saved.exchange) write(EXCHANGE_KEY, saved.exchange);
	else remove(EXCHANGE_KEY);
};
export const saveItinerary = (itinerary: Itinerary) => write(ITINERARY_KEY, itinerary);

function useStored<T>(key: string): T | null | undefined {
	// undefined = not read yet (server render), null = nothing stored.
	const raw = useSyncExternalStore(
		subscribe,
		() => {
			try {
				return sessionStorage.getItem(key);
			} catch {
				return null;
			}
		},
		() => undefined,
	);
	return useMemo(() => {
		if (raw === undefined) return undefined;
		if (raw === null) return null;
		try {
			return JSON.parse(raw) as T;
		} catch {
			return null;
		}
	}, [raw]);
}

/** The current trip, with defaults filled in for fields older versions didn't have. */
export function useStoredTrip(): TripInput | null | undefined {
	const raw = useStored<unknown>(TRIP_KEY);
	return useMemo(() => {
		if (raw === undefined || raw === null) return raw;
		const parsed = TripInputSchema.safeParse(raw);
		return parsed.success ? parsed.data : null;
	}, [raw]);
}
/** The open itinerary, normalised the same way as saved trips so they compare equal. */
export function useStoredItinerary(): Itinerary | null | undefined {
	const raw = useStored<unknown>(ITINERARY_KEY);
	return useMemo(() => (raw === undefined || raw === null ? raw : parseStoredItinerary(raw)), [raw]);
}
export const useStoredSavedId = () => useStored<string>(SAVED_ID_KEY);

export function useStoredExchange(): ExchangeRate | null | undefined {
	const raw = useStored<unknown>(EXCHANGE_KEY);
	return useMemo(() => {
		if (raw === undefined || raw === null) return raw;
		const parsed = ExchangeRateSchema.safeParse(raw);
		return parsed.success ? parsed.data : null;
	}, [raw]);
}
