import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { partialParse } from "@anthropic-ai/sdk/_vendor/partial-json-parser/parser";
import { anthropic, ITINERARY_MODEL } from "@/lib/anthropic";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/itinerary-prompt";
import {
	ItinerarySchema,
	TripInputSchema,
	type PartialItinerary,
	type StreamEvent,
} from "@/lib/itinerary-schema";

// Long generations can take a minute or more.
export const maxDuration = 300;

// How often (ms) to send a partial itinerary to the browser while Claude writes.
const PARTIAL_INTERVAL_MS = 150;

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

	const encoder = new TextEncoder();

	// 2. Stream newline-delimited JSON (one StreamEvent per line) back to the browser.
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: StreamEvent) =>
				controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

			try {
				// 3. Ask Claude, constrained to the itinerary schema (structured output).
				const claude = anthropic.beta.messages.stream(
					{
						model: ITINERARY_MODEL,
						max_tokens: 64000,
						output_config: {
							effort: "medium",
							format: betaZodOutputFormat(ItinerarySchema),
						},
						// If the model declines on safety grounds, the API retries on a
						// fallback model inside the same request.
						betas: ["server-side-fallback-2026-07-01"],
						fallbacks: "default",
						system: SYSTEM_PROMPT,
						messages: [{ role: "user", content: buildUserMessage(trip) }],
					},
					// Stop paying for tokens if the user cancels or closes the tab.
					{ signal: request.signal },
				);

				// 4. As JSON text arrives, parse what we have so far and forward it.
				let json = "";
				let lastSent = 0;
				for await (const event of claude) {
					// A new text block (e.g. after a fallback) starts the JSON over.
					if (event.type === "content_block_start" && event.content_block.type === "text") {
						json = "";
					}
					if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
						json += event.delta.text;
						const now = Date.now();
						if (now - lastSent >= PARTIAL_INTERVAL_MS) {
							lastSent = now;
							const partial = tryPartialParse(json);
							if (partial) send({ type: "partial", itinerary: partial });
						}
					}
				}

				// 5. Check why the model stopped BEFORE trusting the content.
				const message = await claude.finalMessage();
				if (message.stop_reason === "refusal") {
					send({ type: "error", message: "We couldn't plan this trip. Try changing the details." });
				} else if (message.stop_reason === "max_tokens") {
					send({ type: "error", message: "The itinerary was too long to finish. Try a shorter trip." });
				} else if (!message.parsed_output) {
					send({ type: "error", message: "Something went wrong reading the itinerary. Please try again." });
				} else {
					// parsed_output has already been validated against ItinerarySchema.
					send({ type: "done", itinerary: message.parsed_output });
				}
			} catch (error) {
				if (request.signal.aborted) {
					// The browser went away; nobody is listening.
				} else {
					console.error("[itinerary]", error);
					send({ type: "error", message: errorMessage(error) });
				}
			} finally {
				try {
					controller.close();
				} catch {
					// Already closed because the client disconnected.
				}
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "application/x-ndjson; charset=utf-8",
			"Cache-Control": "no-cache, no-transform",
		},
	});
}

function tryPartialParse(json: string): PartialItinerary | null {
	try {
		return partialParse(json) as PartialItinerary;
	} catch {
		return null;
	}
}

function errorMessage(error: unknown) {
	if (error instanceof Anthropic.AuthenticationError) {
		return "The server's Anthropic API key is missing or invalid.";
	}
	if (error instanceof Anthropic.RateLimitError) {
		return "Too many requests right now. Wait a moment and try again.";
	}
	if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) {
		return "Claude is temporarily unavailable. Please try again.";
	}
	return "Something went wrong while planning. Please try again.";
}
