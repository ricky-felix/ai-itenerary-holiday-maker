import { ndjsonResponse, streamStructured } from "@/lib/claude-stream";
import { fetchRates, ratesForPrompt } from "@/lib/exchange";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/itinerary-prompt";
import {
	applyTravellerCosts,
	ItinerarySchema,
	TripInputSchema,
	type PartialItinerary,
	type StreamEvent,
} from "@/lib/itinerary-schema";

// Long generations can take a minute or more.
export const maxDuration = 300;

export async function POST(request: Request) {
	// 1. Validate the form input. Never trust the browser.
	const body = await request.json().catch(() => null);
	const parsed = TripInputSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json(
			{ error: parsed.error.issues[0]?.message ?? "Invalid trip details" },
			{ status: 400 },
		);
	}
	const trip = parsed.data;

	// 2. Stream the itinerary back as it's written, one JSON event per line.
	return ndjsonResponse<StreamEvent>(request.signal, async (send) => {
		// Today's rates, so local prices convert with a real rate instead of the
		// model's memory. If the service is down, Claude plans without them.
		const rates = await fetchRates(trip.currency, request.signal);

		const result = await streamStructured({
			schema: ItinerarySchema,
			system: SYSTEM_PROMPT,
			messages: [{ role: "user", content: buildUserMessage(trip, rates && ratesForPrompt(rates)) }],
			signal: request.signal,
			onPartial: (partial) => send({ type: "partial", itinerary: partial as PartialItinerary }),
		});

		if (!result.ok) {
			send({ type: "error", message: result.message });
			return;
		}
		// Hotel and flight prices the traveller set always win over the model's numbers.
		const itinerary = applyTravellerCosts(result.data, trip);
		// The rate the plan was priced with becomes the one shown in the budget card.
		const local = itinerary.localCurrency;
		const exchange =
			rates && local !== trip.currency && rates.rates[local]
				? {
						from: trip.currency,
						to: local,
						rate: rates.rates[local],
						updatedAt: rates.updatedAt,
						checkedAt: new Date().toISOString(),
					}
				: null;
		send({ type: "done", itinerary, exchange });
	});
}
