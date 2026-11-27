"use client";

import { useMemo, useSyncExternalStore } from "react";
import { nanoid } from "nanoid";
import {
	ExchangeRateSchema,
	parseStoredItinerary,
	TripInputSchema,
	type ExchangeRate,
	type Itinerary,
	type TripInput,
} from "./itinerary-schema";

// Trips the user chose to keep, stored on this device in localStorage.
// Unlike sessionStorage, this survives closing the tab or browser. There's no
// account or server: clearing site data, or using another device, starts empty.

const KEY = "holiday-maker:saved-trips";
export const MAX_TRIP_NAME = 80;

/** "4 days in Lisbon": the suggested name for a trip. */
export function defaultTripName(itinerary: Itinerary) {
	const n = itinerary.days.length;
	return `${n} day${n === 1 ? "" : "s"} in ${itinerary.destinationName}`;
}

export type SavedTrip = {
	id: string;
	/** The name you gave it when saving (also the PDF file name). */
	name: string;
	savedAt: string;
	trip: TripInput;
	itinerary: Itinerary;
	exchange: ExchangeRate | null;
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
	listeners.add(listener);
	// Keep other open tabs in sync too.
	const onStorage = (e: StorageEvent) => {
		if (e.key === KEY) listener();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}

function readRaw() {
	try {
		return localStorage.getItem(KEY) ?? "[]";
	} catch {
		return "[]";
	}
}

function parse(raw: string): SavedTrip[] {
	try {
		const value: unknown = JSON.parse(raw);
		if (!Array.isArray(value)) return [];
		// Skip anything corrupted or saved by an older version of the app.
		return value.flatMap((entry) => {
			const trip = TripInputSchema.safeParse(entry?.trip);
			const itinerary = parseStoredItinerary(entry?.itinerary);
			const exchange = ExchangeRateSchema.safeParse(entry?.exchange);
			if (typeof entry?.id !== "string" || !trip.success || !itinerary) return [];
			return [
				{
					id: entry.id,
					// Trips saved before names existed get the default title.
					name:
						typeof entry.name === "string" && entry.name.trim()
							? entry.name.trim().slice(0, MAX_TRIP_NAME)
							: defaultTripName(itinerary),
					savedAt: String(entry.savedAt),
					trip: trip.data,
					itinerary,
					exchange: exchange.success ? exchange.data : null,
				},
			];
		});
	} catch {
		return [];
	}
}

function writeAll(list: SavedTrip[]) {
	// Throws if storage is full or blocked; callers show a message.
	localStorage.setItem(KEY, JSON.stringify(list));
	notify();
}

/** Saves (or updates, when `id` is given) a trip on this device. Returns its id. */
export function saveToDevice(
	trip: TripInput,
	itinerary: Itinerary,
	options: { id?: string; name?: string; exchange?: ExchangeRate | null } = {},
) {
	const entry: SavedTrip = {
		id: options.id ?? nanoid(10),
		name: options.name?.trim().slice(0, MAX_TRIP_NAME) || defaultTripName(itinerary),
		savedAt: new Date().toISOString(),
		trip,
		itinerary,
		exchange: options.exchange ?? null,
	};
	const others = parse(readRaw()).filter((e) => e.id !== entry.id);
	writeAll([entry, ...others]); // newest first
	return entry.id;
}

export function deleteSaved(id: string) {
	try {
		writeAll(parse(readRaw()).filter((e) => e.id !== id));
	} catch {
		// Storage blocked; nothing to delete.
	}
}

/** All saved trips, newest first. undefined while rendering on the server. */
export function useSavedTrips(): SavedTrip[] | undefined {
	const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);
	return useMemo(() => (raw === undefined ? undefined : parse(raw)), [raw]);
}
