import { streamStructured } from "@/lib/claude-stream";
import { buildPlacesMessage, PLACES_SYSTEM_PROMPT } from "@/lib/itinerary-prompt";
import { PlaceSuggestionsSchema, TripInputSchema } from "@/lib/itinerary-schema";

export const maxDuration = 60;

// Suggests places for the traveller to pick from before the itinerary is planned.
export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	const parsed = TripInputSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json(
			{ error: parsed.error.issues[0]?.message ?? "Invalid trip details" },
			{ status: 400 },
		);
	}

	// A short answer, so we wait for it whole instead of streaming it to the browser.
	const result = await streamStructured({
		schema: PlaceSuggestionsSchema,
		system: PLACES_SYSTEM_PROMPT,
		messages: [{ role: "user", content: buildPlacesMessage(parsed.data) }],
		signal: request.signal,
		effort: "low", // quick suggestions, not deep planning
	});

	if (!result.ok) return Response.json({ error: result.message }, { status: 502 });
	return Response.json({ places: result.data.places });
}
