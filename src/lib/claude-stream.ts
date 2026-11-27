import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { partialParse } from "@anthropic-ai/sdk/_vendor/partial-json-parser/parser";
import type { z } from "zod";
import { anthropic, ITINERARY_MODEL } from "./anthropic";

// How often (ms) to report partial output while Claude writes.
const PARTIAL_INTERVAL_MS = 150;

export type StructuredResult<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * Streams a Claude response constrained to `schema` (structured output).
 * Calls `onPartial` with the half-written JSON parsed so far, then returns the
 * validated result, or a user-friendly error message.
 */
export async function streamStructured<S extends z.ZodType>(opts: {
	schema: S;
	system: string;
	messages: Anthropic.Beta.BetaMessageParam[];
	signal: AbortSignal;
	onPartial?: (partial: unknown) => void;
	/** How hard Claude thinks before answering. Lower is faster and cheaper. */
	effort?: "low" | "medium" | "high";
}): Promise<StructuredResult<z.infer<S>>> {
	try {
		const stream = anthropic.beta.messages.stream(
			{
				model: ITINERARY_MODEL,
				max_tokens: 64000,
				output_config: {
					effort: opts.effort ?? "medium",
					format: betaZodOutputFormat(opts.schema),
				},
				// If the model declines on safety grounds, the API retries on a
				// fallback model inside the same request.
				betas: ["server-side-fallback-2026-07-01"],
				fallbacks: "default",
				system: opts.system,
				messages: opts.messages,
			},
			// Stop paying for tokens if the user cancels or closes the tab.
			{ signal: opts.signal },
		);

		let json = "";
		let lastSent = 0;
		for await (const event of stream) {
			// A new text block (e.g. after a fallback) starts the JSON over.
			if (event.type === "content_block_start" && event.content_block.type === "text") {
				json = "";
			}
			if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
				json += event.delta.text;
				const now = Date.now();
				if (opts.onPartial && now - lastSent >= PARTIAL_INTERVAL_MS) {
					lastSent = now;
					const partial = tryPartialParse(json);
					if (partial !== undefined) opts.onPartial(partial);
				}
			}
		}

		// Check why the model stopped BEFORE trusting the content.
		const message = await stream.finalMessage();
		if (message.stop_reason === "refusal") {
			return { ok: false, message: "Sorry, I can't help with that. Try rephrasing or changing the details." };
		}
		if (message.stop_reason === "max_tokens") {
			return { ok: false, message: "The response was too long to finish. Try a shorter trip or a smaller change." };
		}
		// parsed_output has already been validated against the schema.
		const parsed = message.parsed_output as z.infer<S> | null | undefined;
		if (parsed == null) {
			return { ok: false, message: "Something went wrong reading the response. Please try again." };
		}
		return { ok: true, data: parsed };
	} catch (error) {
		if (opts.signal.aborted) return { ok: false, message: "Cancelled" };
		console.error("[claude]", error);
		return { ok: false, message: errorMessage(error) };
	}
}

/** A streamed response of newline-delimited JSON events. */
export function ndjsonResponse<E>(signal: AbortSignal, run: (send: (event: E) => void) => Promise<void>) {
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: E) => {
				if (signal.aborted) return; // nobody is listening any more
				controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
			};
			try {
				await run(send);
			} finally {
				try {
					controller.close();
				} catch {
					// Already closed because the client disconnected.
				}
			}
		},
	});
	return new Response(body, {
		headers: {
			"Content-Type": "application/x-ndjson; charset=utf-8",
			"Cache-Control": "no-cache, no-transform",
		},
	});
}

function tryPartialParse(json: string): unknown {
	try {
		return partialParse(json);
	} catch {
		return undefined;
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
	return "Something went wrong. Please try again.";
}
