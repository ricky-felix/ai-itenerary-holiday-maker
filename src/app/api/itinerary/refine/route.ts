import { ndjsonResponse, streamStructured } from "@/lib/claude-stream";
import { buildRefineMessages, REFINE_SYSTEM_PROMPT } from "@/lib/itinerary-prompt";
import {
	applyTravellerCosts,
	RefineOutputSchema,
	RefineRequestSchema,
	tripDayCount,
	type RefineEvent,
} from "@/lib/itinerary-schema";

export const maxDuration = 300;

// Answers a question about the itinerary, or returns an updated itinerary.
export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	const parsed = RefineRequestSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json(
			{ error: parsed.error.issues[0]?.message ?? "Invalid request" },
			{ status: 400 },
		);
	}
	const input = parsed.data;

	return ndjsonResponse<RefineEvent>(request.signal, async (send) => {
		let lastReply = "";
		let updatingSent = false;

		const result = await streamStructured({
			schema: RefineOutputSchema,
			system: REFINE_SYSTEM_PROMPT,
			messages: buildRefineMessages(input),
			signal: request.signal,
			onPartial: (value) => {
				const partial = value as { reply?: unknown; itinerary?: unknown };
				// Stream the reply text as it grows.
				if (typeof partial.reply === "string" && partial.reply !== lastReply) {
					lastReply = partial.reply;
					send({ type: "reply", text: partial.reply });
				}
				// Once Claude starts writing a new itinerary, tell the UI.
				if (partial.itinerary && typeof partial.itinerary === "object" && !updatingSent) {
					updatingSent = true;
					send({ type: "updating" });
				}
			},
		});

		if (!result.ok) {
			send({ type: "error", message: result.message });
			return;
		}

		let { reply, itinerary } = result.data;
		// The schema can't enforce the day count, so check it here.
		if (itinerary && itinerary.days.length !== tripDayCount(input.trip)) {
			itinerary = null;
			reply += " (I couldn't apply that change because it altered the number of days. To change your dates, plan a new trip.)";
		}
		send({ type: "done", reply, itinerary: itinerary && applyTravellerCosts(itinerary, input.trip) });
	});
}
