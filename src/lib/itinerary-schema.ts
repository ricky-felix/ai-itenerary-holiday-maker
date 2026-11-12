import { z } from "zod";

// ---------------------------------------------------------------------------
// What the user sends us (the trip form). Validated on the server too, because
// anything coming from the browser can be tampered with.
// ---------------------------------------------------------------------------

export const CURRENCIES = ["EUR", "GBP", "USD"] as const;
export const TRAVELLERS = ["1 adult", "2 adults", "Family", "Group"] as const;
export const PACES = ["Relaxed", "Balanced", "Packed"] as const;
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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const TripInputSchema = z
	.object({
		destination: z.string().trim().min(2, "Enter a destination").max(120, "Keep the destination short"),
		startDate: isoDate,
		endDate: isoDate,
		currency: z.enum(CURRENCIES),
		budget: z.number("Enter a budget").positive("Enter a budget above 0").max(1_000_000),
		travellers: z.enum(TRAVELLERS),
		interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
		pace: z.enum(PACES),
		notes: z.string().max(1000),
	})
	.refine((t) => tripDayCount(t) >= 1, {
		message: "Leave date must be on or after the arrive date",
		path: ["endDate"],
	})
	.refine((t) => tripDayCount(t) <= MAX_TRIP_DAYS, {
		message: `Trips can be up to ${MAX_TRIP_DAYS} days`,
		path: ["endDate"],
	});

export type TripInput = z.infer<typeof TripInputSchema>;

// ---------------------------------------------------------------------------
// What Claude must return. This schema is sent to the API as structured output,
// so the model is constrained to produce JSON in exactly this shape.
// .describe() text is part of the schema the model sees, so it doubles as
// per-field instructions.
// ---------------------------------------------------------------------------

export const ITEM_TAGS = [...INTERESTS, "Getting around", "Evening"] as const;

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
	title: z.string().describe('Short theme for the day, e.g. "Alfama & the castle"'),
	summary: z.string().describe("One sentence describing the day"),
	items: z.array(ItineraryItemSchema),
});

export const ItinerarySchema = z.object({
	destinationName: z
		.string()
		.describe('Short place name for headings, e.g. "Lisbon"'),
	days: z.array(ItineraryDaySchema).describe("Exactly one entry per trip day, in order"),
	budget: z.object({
		stay: z.number().describe("Accommodation for all nights"),
		food: z.number().describe("Food & drink"),
		activities: z.number().describe("Tickets and activities"),
		transport: z.number().describe("Getting around, including day trips"),
	}),
	tips: z.array(z.string()).describe("Two to four short, destination-specific tips"),
});

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
	| { type: "done"; itinerary: Itinerary }
	| { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Small date/money helpers shared by the server and the UI.
// ---------------------------------------------------------------------------

const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);

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

export function formatMoney(amount: number, currency: TripInput["currency"]) {
	if (amount === 0) return "Free";
	return new Intl.NumberFormat("en-GB", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(amount);
}
