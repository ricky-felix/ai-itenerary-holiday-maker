"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Itinerary, TripInput } from "./itinerary-schema";

// v1 has no database, so the trip and its itinerary are passed between pages via
// sessionStorage (per browser tab, cleared when the tab closes). Share links will
// need real storage.

const TRIP_KEY = "holiday-maker:trip";
const ITINERARY_KEY = "holiday-maker:itinerary";

function write(key: string, value: unknown) {
	try {
		sessionStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage can be unavailable (private mode); the flow just won't persist.
	}
}

export const saveTrip = (trip: TripInput) => {
	write(TRIP_KEY, trip);
	try {
		sessionStorage.removeItem(ITINERARY_KEY);
	} catch {}
};
export const saveItinerary = (itinerary: Itinerary) => write(ITINERARY_KEY, itinerary);

const subscribe = () => () => {};

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

export const useStoredTrip = () => useStored<TripInput>(TRIP_KEY);
export const useStoredItinerary = () => useStored<Itinerary>(ITINERARY_KEY);
