import { z } from "zod";
import { fetchRates } from "@/lib/exchange";

// Current exchange rate between two currencies. The browser stores the result
// and doesn't ask again unless the traveller edits their budget.

const Query = z.object({
	from: z.string().regex(/^[A-Z]{3}$/),
	to: z.string().regex(/^[A-Z]{3}$/),
});

export async function GET(request: Request) {
	const params = Object.fromEntries(new URL(request.url).searchParams);
	const query = Query.safeParse(params);
	if (!query.success) return Response.json({ error: "Use 3-letter currency codes" }, { status: 400 });
	const { from, to } = query.data;

	const table = await fetchRates(from, request.signal);
	const rate = table?.rates[to];
	if (!table || !rate) return Response.json({ error: "Exchange rate not available" }, { status: 502 });
	return Response.json({ from, to, rate, updatedAt: table.updatedAt, checkedAt: new Date().toISOString() });
}
