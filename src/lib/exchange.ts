import "server-only";
import { z } from "zod";

// Exchange rates from the free open.er-api.com service (no API key, updated
// daily). Only a currency code is sent to it.

const Upstream = z.object({
	result: z.literal("success"),
	time_last_update_utc: z.string(),
	rates: z.record(z.string(), z.number()),
});

export type RateTable = { base: string; rates: Record<string, number>; updatedAt: string };

/** All rates for `base` (1 base = rates[code] code), or null if the service is unavailable. */
export async function fetchRates(base: string, signal?: AbortSignal): Promise<RateTable | null> {
	try {
		const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
			cache: "no-store",
			// Don't hold up itinerary generation for long if the service is slow.
			signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
		});
		const data = Upstream.safeParse(await res.json());
		if (!data.success) return null;
		return {
			base,
			rates: data.data.rates,
			updatedAt: new Date(data.data.time_last_update_utc).toISOString(),
		};
	} catch {
		return null;
	}
}

/** Rates as prompt text: one "1 AUD = 12195.12 IDR" line per currency. */
export function ratesForPrompt(table: RateTable) {
	return Object.entries(table.rates)
		.filter(([code, rate]) => code !== table.base && rate > 0)
		.map(([code, rate]) => `1 ${code} = ${round(1 / rate)} ${table.base}`)
		.join("\n");
}

const round = (n: number) => (n >= 100 ? Math.round(n) : Number(n.toPrecision(4)));
