"use client";

import { useEffect, useState } from "react";
import {
	COMPARE_CURRENCIES,
	formatAmount,
	formatDate,
	formatMoney,
	type TripInput,
} from "@/lib/itinerary-schema";
import { saveExchange, useStoredExchange } from "@/lib/trip-session";

/**
 * Exchange rate box under the total budget: "IDR → AUD", what the budget is worth
 * there, the rate, and when it was checked. Always shown. The rate is stored with
 * the trip and only refreshes after a budget edit or when you pick another currency.
 */
export function ExchangeBanner({ trip, localCurrency }: { trip: TripInput; localCurrency: string }) {
	const stored = useStoredExchange();
	const [picked, setPicked] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const from = trip.currency;

	// Target currency: your pick, else the stored rate's, else the destination's.
	const to =
		picked ??
		(stored && stored.from === from ? stored.to : null) ??
		(localCurrency && localCurrency !== from ? localCurrency : null);
	const rate = stored && stored.from === from && stored.to === to ? stored : null;

	// Fetch only when there's no stored rate for this pair.
	useEffect(() => {
		if (stored === undefined || !to || rate) return;
		const controller = new AbortController();
		(async () => {
			try {
				const res = await fetch(`/api/exchange?from=${from}&to=${to}`, { signal: controller.signal });
				const body = await res.json().catch(() => null);
				if (controller.signal.aborted) return;
				if (!res.ok || !body?.rate) {
					setFailed(true);
					return;
				}
				setFailed(false);
				saveExchange(body);
			} catch {
				if (!controller.signal.aborted) setFailed(true);
			}
		})();
		return () => controller.abort();
	}, [stored, to, rate, from]);

	const options = Array.from(new Set([...(to ? [to] : []), ...COMPARE_CURRENCIES])).filter((c) => c !== from);

	return (
		<section aria-label="Exchange rate" className="flex flex-col gap-1.5 rounded-xl border border-[#E2E0D8] bg-[#F4F3EF] px-3.5 py-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-[12px] font-semibold tracking-[0.06em] text-[#5B5E66] uppercase">Exchange rate</span>
				<label className="flex items-center gap-1.5 text-sm font-semibold text-[#16181D]">
					<span>{from} →</span>
					<span className="sr-only">Convert to</span>
					<select
						value={to ?? ""}
						onChange={(e) => {
							setFailed(false);
							setPicked(e.target.value || null);
						}}
						className="min-h-9 rounded-lg border border-[#CFCCC2] bg-white px-2 text-sm font-semibold focus:outline-2 focus:outline-[#0F6B5C]"
					>
						{!to && <option value="">Choose…</option>}
						{options.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				</label>
			</div>

			{!to ? (
				<p className="m-0 text-[13px] text-[#5B5E66]">
					Your budget is in {from}. Pick a currency to see what it&apos;s worth there.
				</p>
			) : failed && !rate ? (
				<p className="m-0 text-[13px] text-[#5B5E66]">The {from} → {to} rate isn&apos;t available right now.</p>
			) : !rate ? (
				<div aria-hidden="true" className="animate-soft-pulse flex flex-col gap-1.5 py-0.5">
					<div className="h-4 w-2/3 rounded bg-[#E2E0D8]" />
					<div className="h-3 w-1/2 rounded bg-[#E2E0D8]" />
				</div>
			) : (
				<>
					<p className="m-0 text-[15px] font-semibold text-[#16181D]">
						<span className="whitespace-nowrap">{formatMoney(trip.budget, from)}</span> ≈{" "}
						<span className="whitespace-nowrap">{formatAmount(trip.budget * rate.rate, rate.to)}</span>
					</p>
					<p className="m-0 text-[13px] text-[#4A4D55]">
						<span className="whitespace-nowrap">1 {rate.to} = {formatAmount(1 / rate.rate, from)}</span>
						{" · "}
						<span className="whitespace-nowrap">
							1 {from} = {formatAmount(rate.rate, rate.to)}
						</span>
					</p>
					<p className="m-0 text-[12px] text-[#5B5E66]">
						Rate published {formatDate(rate.updatedAt)}
						{rate.checkedAt && <> · checked {formatDate(rate.checkedAt, true)}</>} · updates when you edit the
						budget ·{" "}
						<a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="underline">
							Rates by Exchange Rate API
						</a>
					</p>
				</>
			)}
		</section>
	);
}
