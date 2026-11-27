import { streamStructured } from "@/lib/claude-stream";
import { fetchRates, ratesForPrompt } from "@/lib/exchange";
import { buildEstimateMessage, ESTIMATE_SYSTEM_PROMPT } from "@/lib/itinerary-prompt";
import { CostEstimateSchema, EstimateRequestSchema } from "@/lib/itinerary-schema";

export const maxDuration = 60;

// Estimates hotel and/or ticket costs when the traveller switches them to "Estimate"
// on the itinerary page. A short answer, so it's returned whole, not streamed.
export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	const parsed = EstimateRequestSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
	}
	const { trip, stay, tickets } = parsed.data;
	if (!stay && !tickets) return Response.json({ stay: 0, tickets: 0 });

	// Today's rates, so prices convert with a real rate (planning continues without them).
	const rates = await fetchRates(trip.currency, request.signal);
	const ratesText = rates ? `\n\n<exchange_rates_today>\n${ratesForPrompt(rates)}\n</exchange_rates_today>` : "";

	const result = await streamStructured({
		schema: CostEstimateSchema,
		system: ESTIMATE_SYSTEM_PROMPT,
		messages: [{ role: "user", content: buildEstimateMessage(trip, { stay, tickets }) + ratesText }],
		signal: request.signal,
		effort: "low",
	});

	if (!result.ok) return Response.json({ error: result.message }, { status: 502 });
	return Response.json(result.data);
}
