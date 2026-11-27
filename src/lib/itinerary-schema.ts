import { z } from "zod";

// ---------------------------------------------------------------------------
// What the user sends us (the trip form). Validated on the server too, because
// anything coming from the browser can be tampered with.
// ---------------------------------------------------------------------------

export const CURRENCIES = ["EUR", "GBP", "USD", "IDR"] as const;
export const TRAVELLERS = ["1 adult", "2 adults", "Family", "Group"] as const;
export const PACES = ["Relaxed", "Balanced", "Packed", "Business"] as const;
export const TRIP_TYPES = ["single", "transit", "multi"] as const;
export const TRANSIT_LEGS = ["outbound", "return", "both"] as const;
export const INTERESTS = [
	"Food & drink",
	"History",
	"Art & museums",
	"Nature",
	"Beaches",
	"Nightlife",
	"Shopping",
	"Viewpoints",
	"Family-friendly",
	"Hidden gems",
] as const;

export const MAX_TRIP_DAYS = 14;
export const MAX_MUST_SEE = 15;
export const MAX_EXTRA_STOPS = 5;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const TripInputSchema = z
	.object({
		destination: z.string().trim().min(2, "Enter a destination").max(120, "Keep the destination short"),
		startDate: isoDate,
		endDate: isoDate,
		currency: z.enum(CURRENCIES),
		budget: z.number("Enter a budget").positive("Enter a budget above 0").max(10_000_000_000), // high enough for IDR
		travellers: z.enum(TRAVELLERS),
		interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
		pace: z.enum(PACES),
		notes: z.string().max(1000),
		// Places the traveller picked on the "Before we plan" step.
		mustSee: z.array(z.string().trim().min(1).max(120)).max(MAX_MUST_SEE).default([]),
		// Hotel: Claude estimates it, the traveller enters a price, or it's not in the budget.
		stay: z
			.discriminatedUnion("mode", [
				z.object({ mode: z.literal("estimate") }),
				z.object({
					mode: z.literal("manual"),
					amount: z.number("Enter your hotel price").positive("Enter a hotel price above 0").max(10_000_000_000),
					per: z.enum(["night", "total"]),
				}),
				z.object({ mode: z.literal("excluded") }),
			])
			.default({ mode: "estimate" }),
		// Arrival and departure flights (stored as "travelTickets" so older saved trips still load):
		// same three choices as the hotel.
		// Estimating needs to know where the traveller starts (`origin`).
		travelTickets: z
			.discriminatedUnion("mode", [
				z.object({ mode: z.literal("estimate") }),
				z.object({
					mode: z.literal("manual"),
					amount: z.number("Enter your flight price").positive("Enter a flight price above 0").max(10_000_000_000),
				}),
				z.object({ mode: z.literal("excluded") }),
			])
			.default({ mode: "excluded" }),
		origin: z.string().trim().max(120).default(""),
		// Single destination, a transit (layover) stop on the way, or several destinations.
		tripType: z.enum(TRIP_TYPES).default("single"),
		// A connection city with no overnight stay (tripType "transit").
		transit: z
			.object({
				place: z.string().trim().min(2, "Enter the city you're transiting through").max(120),
				leg: z.enum(TRANSIT_LEGS),
			})
			.nullable()
			.default(null),
		// Further destinations after the first, in order. The first destination
		// gets whatever nights are left.
		stops: z
			.array(
				z.object({
					place: z.string().trim().min(2, "Enter each extra destination").max(120),
					nights: z.number("Enter nights for each destination").int().min(1, "Each extra destination needs at least 1 night"),
				}),
			)
			.max(MAX_EXTRA_STOPS)
			.default([]),
	})
	.refine((t) => tripDayCount(t) >= 1, {
		message: "Leave date must be on or after the arrive date",
		path: ["endDate"],
	})
	.refine((t) => tripDayCount(t) <= MAX_TRIP_DAYS, {
		message: `Trips can be up to ${MAX_TRIP_DAYS} days`,
		path: ["endDate"],
	})
	.refine((t) => t.tripType !== "transit" || t.transit !== null, {
		message: "Enter the city you're transiting through",
		path: ["transit"],
	})
	.refine((t) => t.tripType !== "multi" || t.stops.length > 0, {
		message: "Add at least one more destination, or choose Single destination",
		path: ["stops"],
	})
	.refine((t) => t.stops.length === 0 || firstStopNights(t) >= 1, {
		message: "Leave at least 1 night for your first destination, or pick later dates",
		path: ["stops"],
	})
	.refine((t) => t.travelTickets.mode !== "estimate" || t.origin.length >= 2, {
		message: "Tell us where you're flying from so we can estimate flights",
		path: ["origin"],
	});

export type TripInput = z.infer<typeof TripInputSchema>;

/** A saved exchange rate: 1 `from` = `rate` `to`. Fetched once, refreshed only on budget edits. */
export const ExchangeRateSchema = z.object({
	from: z.string(),
	to: z.string(),
	rate: z.number().positive(),
	updatedAt: z.string(), // when the provider published the rate
	checkedAt: z.string().optional(), // when the app fetched it
});

/** Currencies offered in the exchange banner's "convert to" menu. */
export const COMPARE_CURRENCIES = [
	"AUD", "CAD", "CHF", "CNY", "EUR", "GBP", "HKD", "IDR", "INR", "JPY", "KRW",
	"MYR", "NZD", "PHP", "SGD", "THB", "AED", "USD", "VND",
] as const;

/** "27 Nov 2026" and, when asked, "27 Nov 2026, 15:40". */
export function formatDate(iso: string, withTime = false) {
	return new Date(iso).toLocaleString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		...(withTime && { hour: "2-digit", minute: "2-digit" }),
	});
}
export type ExchangeRate = z.infer<typeof ExchangeRateSchema>;

// ---------------------------------------------------------------------------
// What Claude must return. This schema is sent to the API as structured output,
// so the model is constrained to produce JSON in exactly this shape.
// .describe() text is part of the schema the model sees, so it doubles as
// per-field instructions.
// ---------------------------------------------------------------------------

export const ITEM_TAGS = [...INTERESTS, "Getting around", "Transit", "Evening"] as const;

export const ItineraryItemSchema = z.object({
	time: z.string().describe('24-hour start time, e.g. "09:30"'),
	title: z.string().describe("Short name of the place or activity"),
	description: z
		.string()
		.describe("One or two sentences of practical, specific advice"),
	cost: z
		.number()
		.describe("Estimated cost for the whole group in the trip currency. 0 if free"),
	tag: z.enum(ITEM_TAGS),
});

export const ItineraryDaySchema = z.object({
	location: z
		.string()
		.describe("The destination this day is based in. On a moving day, the destination being travelled to"),
	title: z.string().describe('Short theme for the day, e.g. "Alfama & the castle"'),
	summary: z.string().describe("One sentence describing the day"),
	items: z.array(ItineraryItemSchema),
});

export const ItinerarySchema = z.object({
	destinationName: z
		.string()
		.describe('Short place name for headings, e.g. "Lisbon". For multi-destination trips, the main places joined, e.g. "Tokyo & Kyoto"'),
	localCurrency: z
		.string()
		.describe('ISO 4217 code of the currency used at the destination, e.g. "AUD" for Sydney'),
	days: z.array(ItineraryDaySchema).describe("Exactly one entry per trip day, in order"),
	budget: z.object({
		stay: z.number().describe("Accommodation for all nights"),
		food: z.number().describe("Food & drink"),
		activities: z.number().describe("Entry tickets and activities"),
		transport: z.number().describe("Getting around locally, including day trips"),
		tickets: z.number().describe("Return economy flights (arrival and departure) for everyone, 0 if not in the budget"),
	}),
	tips: z.array(z.string()).describe("Two to four short, destination-specific tips"),
});

/**
 * Reads a stored itinerary, filling in fields older versions of the app didn't
 * have. Used for both the open trip and saved trips, so they always compare equal.
 */
export function parseStoredItinerary(raw: unknown) {
	const r = raw as { budget?: object; days?: unknown[] } | null | undefined;
	const filled = r?.budget
		? {
				localCurrency: "",
				...r,
				// Days from before multi-destination trips have no location.
				days: Array.isArray(r.days) ? r.days.map((d) => ({ location: "", ...(d as object) })) : r.days,
				budget: { tickets: 0, ...r.budget },
			}
		: raw;
	const parsed = ItinerarySchema.safeParse(filled);
	return parsed.success ? parsed.data : null;
}

export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;

// While streaming we only have part of the JSON, so every field may be missing.
export type PartialItinerary = {
	destinationName?: string;
	days?: (Partial<Omit<ItineraryDay, "items">> & { items?: Partial<ItineraryItem>[] })[];
	budget?: Partial<Itinerary["budget"]>;
	tips?: string[];
};

// Messages the API route streams to the browser, one JSON object per line.
export type StreamEvent =
	| { type: "partial"; itinerary: PartialItinerary }
	| { type: "done"; itinerary: Itinerary; exchange: ExchangeRate | null }
	| { type: "error"; message: string };

// ---------------------------------------------------------------------------
// "Before we plan": place suggestions the traveller can pick from.
// ---------------------------------------------------------------------------

export const PlaceSuggestionsSchema = z.object({
	places: z
		.array(
			z.object({
				name: z.string().describe("The place's common name, short"),
				why: z.string().describe("One short sentence on why it suits this traveller"),
			}),
		)
		.describe("About 8 specific places, no duplicates"),
});
export type PlaceSuggestion = z.infer<typeof PlaceSuggestionsSchema>["places"][number];

// ---------------------------------------------------------------------------
// Re-estimating hotel and/or tickets after the traveller edits the budget.
// ---------------------------------------------------------------------------

export const EstimateRequestSchema = z.object({
	trip: TripInputSchema,
	stay: z.boolean(),
	tickets: z.boolean(),
});

export const CostEstimateSchema = z.object({
	stay: z.number().describe("Accommodation for all nights, whole group. 0 if not asked for"),
	tickets: z.number().describe("Return economy flights for everyone. 0 if not asked for"),
});

// ---------------------------------------------------------------------------
// Follow-up chat on the itinerary page: questions, suggestions and changes.
// ---------------------------------------------------------------------------

export const MAX_CHAT_MESSAGE = 1000;
export const MAX_CHAT_HISTORY = 10;

export const ChatTurnSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string().max(4000),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const RefineRequestSchema = z.object({
	trip: TripInputSchema,
	itinerary: ItinerarySchema,
	history: z.array(ChatTurnSchema).max(MAX_CHAT_HISTORY),
	message: z.string().trim().min(1, "Type a message").max(MAX_CHAT_MESSAGE, "Keep your message shorter"),
	// The rate the app shows, so the assistant converts with the same number.
	exchange: ExchangeRateSchema.nullable().default(null),
});
export type RefineRequest = z.infer<typeof RefineRequestSchema>;

// What Claude returns for a chat message. "reply" comes first so it can stream
// to the user while any itinerary changes are still being written.
export const RefineOutputSchema = z.object({
	reply: z.string().describe("Your answer to the traveller, plain text"),
	itinerary: ItinerarySchema.nullable().describe(
		"The complete updated itinerary if you changed the plan, otherwise null",
	),
});

export type RefineEvent =
	| { type: "reply"; text: string }
	| { type: "updating" }
	| { type: "done"; reply: string; itinerary: Itinerary | null }
	| { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Small date/money helpers shared by the server and the UI.
// ---------------------------------------------------------------------------

const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Nights left for the first destination after the extra stops. */
export function firstStopNights(t: { startDate: string; endDate: string; stops: { nights: number }[] }) {
	const nights = tripDayCount(t) - 1;
	return nights - t.stops.reduce((sum, s) => sum + (Number.isFinite(s.nights) ? s.nights : 0), 0);
}

export type RouteStop = { place: string; nights: number; fromDay: number; toDay: number };

/** Every destination in order, with its nights and the trip days it covers (1-based). */
export function routeStops(t: Pick<TripInput, "destination" | "stops" | "startDate" | "endDate">): RouteStop[] {
	const all = [{ place: t.destination, nights: firstStopNights(t) }, ...t.stops];
	let day = 1;
	return all.map((s) => {
		const stop = { place: s.place, nights: s.nights, fromDay: day, toDay: day + s.nights };
		day += s.nights;
		return stop;
	});
}

/** "Lisbon → Porto" for multi-destination trips, "Sydney · via Singapore" with a transit stop. */
export function routeLabel(t: Pick<TripInput, "destination" | "stops"> & { transit?: TripInput["transit"] }) {
	const route = [t.destination, ...t.stops.map((s) => s.place)].join(" → ");
	return t.transit ? `${route} · via ${t.transit.place}` : route;
}

/** Whether the trip has more than a single destination to show (route or transit). */
export const hasRoute = (t: Pick<TripInput, "stops" | "transit">) => t.stops.length > 0 || t.transit !== null;

export function tripDayCount(t: { startDate: string; endDate: string }) {
	const ms = toUtc(t.endDate).getTime() - toUtc(t.startDate).getTime();
	return Math.round(ms / 86_400_000) + 1;
}

/** "Fri 14 May" for day `index` of the trip (0-based). */
export function dayLabel(startDate: string, index: number) {
	const d = toUtc(startDate);
	d.setUTCDate(d.getUTCDate() + index);
	return d.toLocaleDateString("en-GB", {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

/** "14–17 May 2027" */
export function dateRangeLabel(t: { startDate: string; endDate: string }) {
	const opts = { timeZone: "UTC" } as const;
	const s = toUtc(t.startDate);
	const e = toUtc(t.endDate);
	const end = e.toLocaleDateString("en-GB", { ...opts, day: "numeric", month: "short", year: "numeric" });
	if (s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth()) {
		return `${s.getUTCDate()}–${end}`;
	}
	const start = s.toLocaleDateString("en-GB", { ...opts, day: "numeric", month: "short" });
	return `${start} – ${end}`;
}

/**
 * The hotel cost for the whole stay as the traveller set it: their price, 0 when
 * it's not in the budget, or null when Claude should estimate it.
 */
export function stayTotal(trip: Pick<TripInput, "stay" | "startDate" | "endDate">) {
	if (trip.stay.mode === "estimate") return null;
	if (trip.stay.mode === "excluded") return 0;
	const nights = Math.max(tripDayCount(trip) - 1, 0);
	return trip.stay.per === "night" ? trip.stay.amount * nights : trip.stay.amount;
}

/** Flights as the traveller set them: their price, 0 if excluded, null to estimate. */
export function ticketsTotal(trip: Pick<TripInput, "travelTickets">) {
	if (trip.travelTickets.mode === "estimate") return null;
	return trip.travelTickets.mode === "manual" ? trip.travelTickets.amount : 0;
}

/** Applies the traveller's own hotel and ticket choices exactly, whatever the model wrote. */
export function applyTravellerCosts(itinerary: Itinerary, trip: TripInput): Itinerary {
	const stay = stayTotal(trip);
	const tickets = ticketsTotal(trip);
	return {
		...itinerary,
		budget: {
			...itinerary.budget,
			...(stay !== null && { stay }),
			...(tickets !== null && { tickets }),
		},
	};
}

export type BudgetLine = { label: string; amount: number | null; note?: string };

/** Budget lines and total for display (screen and PDF). amount null = not in budget. */
export function budgetBreakdown(itinerary: Itinerary, trip: TripInput) {
	const nights = Math.max(itinerary.days.length - 1, 0);
	const stayLabel = `Stay (${nights} night${nights === 1 ? "" : "s"})`;
	const { stay, food, activities, transport } = itinerary.budget;
	const tickets = itinerary.budget.tickets ?? 0; // older itineraries had no tickets
	const note = (mode: "estimate" | "manual") => (mode === "manual" ? "your price" : "estimate");

	const lines: BudgetLine[] = [
		trip.stay.mode === "excluded"
			? { label: stayLabel, amount: null, note: "not in budget" }
			: { label: stayLabel, amount: stay, note: note(trip.stay.mode) },
		trip.travelTickets.mode === "excluded"
			? { label: "Flights", amount: null, note: "not in budget" }
			: { label: "Flights", amount: tickets, note: note(trip.travelTickets.mode) },
		{ label: "Food & drink", amount: food },
		{ label: "Activities", amount: activities },
		{ label: "Getting around", amount: transport },
	];
	const total = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
	return { lines, total };
}

/**
 * Formats any currency code (not just the trip currencies). `display: "code"`
 * writes "KRW 1,000" instead of a symbol, for the PDF font which lacks some symbols.
 */
export function formatAmount(amount: number, currency: string, display: "symbol" | "code" = "symbol") {
	try {
		return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-GB", {
			style: "currency",
			currency,
			currencyDisplay: display,
			// Tiny per-unit rates (1 IDR = 0.000082 AUD) need significant digits, not 2 decimals.
			...(Math.abs(amount) > 0 && Math.abs(amount) < 1
				? { maximumSignificantDigits: 3 }
				: { maximumFractionDigits: Math.abs(amount) < 100 ? 2 : 0 }),
		}).format(amount);
	} catch {
		return `${amount.toFixed(2)} ${currency}`; // unknown currency code
	}
}

export function formatMoney(amount: number, currency: TripInput["currency"]) {
	if (amount === 0) return "Free";
	// Rupiah reads naturally in Indonesian format: "Rp 1.200.000".
	return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-GB", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(amount);
}
