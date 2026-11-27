"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
	applyTravellerCosts,
	formatMoney,
	tripDayCount,
	TripInputSchema,
	type Itinerary,
	type TripInput,
} from "@/lib/itinerary-schema";
import { clearExchange, saveItinerary, updateTrip } from "@/lib/trip-session";
import { CostChoice, isBlank, type CostMode } from "./cost-choice";

const ACCENT = "#0F6B5C";
const heading = "font-[family-name:var(--font-space-grotesk)]";
const label = "text-sm font-semibold";
const focus = "focus:outline-2 focus:outline-offset-1 focus:outline-[#0F6B5C]";

/**
 * Edit the total budget, hotel and flights after the itinerary exists.
 * Your own prices and "not in budget" apply instantly; switching to "Estimate"
 * asks Claude for just those numbers. The activities in the plan don't change.
 */
export function BudgetEditor({
	trip,
	itinerary,
	onClose,
}: {
	trip: TripInput;
	itinerary: Itinerary;
	onClose: () => void;
}) {
	const [budget, setBudget] = useState(trip.budget);
	const [stayMode, setStayMode] = useState<CostMode>(trip.stay.mode);
	const [stayAmount, setStayAmount] = useState(trip.stay.mode === "manual" ? trip.stay.amount : Number.NaN);
	const [stayPer, setStayPer] = useState<"night" | "total">(trip.stay.mode === "manual" ? trip.stay.per : "night");
	const [ticketMode, setTicketMode] = useState<CostMode>(trip.travelTickets.mode);
	const [ticketAmount, setTicketAmount] = useState(
		trip.travelTickets.mode === "manual" ? trip.travelTickets.amount : Number.NaN,
	);
	const [origin, setOrigin] = useState(trip.origin);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const nights = Math.max(tripDayCount(trip) - 1, 0);

	async function apply(e: React.FormEvent) {
		e.preventDefault();
		// Same rules as the trip form: a blank price means "not in budget".
		const result = TripInputSchema.safeParse({
			...trip,
			budget,
			origin,
			stay:
				stayMode === "manual"
					? isBlank(stayAmount)
						? { mode: "excluded" }
						: { mode: "manual", amount: stayAmount, per: stayPer }
					: { mode: stayMode },
			travelTickets:
				ticketMode === "manual"
					? isBlank(ticketAmount)
						? { mode: "excluded" }
						: { mode: "manual", amount: ticketAmount }
					: { mode: ticketMode },
		});
		if (!result.success) {
			setError(result.error.issues[0]?.message ?? "Check your budget details");
			return;
		}
		const next = result.data;

		// Only ask Claude when something newly needs estimating.
		const needStay = next.stay.mode === "estimate" && trip.stay.mode !== "estimate";
		const needTickets =
			next.travelTickets.mode === "estimate" &&
			(trip.travelTickets.mode !== "estimate" || next.origin !== trip.origin);

		setBusy(true);
		setError(null);
		try {
			let updated = itinerary;
			if (needStay || needTickets) {
				const res = await fetch("/api/itinerary/estimate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ trip: next, stay: needStay, tickets: needTickets }),
				});
				const body = await res.json().catch(() => null);
				if (!res.ok || !body) {
					setError(body?.error ?? "Couldn't get an estimate. Please try again.");
					return;
				}
				updated = {
					...updated,
					budget: {
						...updated.budget,
						...(needStay && { stay: body.stay }),
						...(needTickets && { tickets: body.tickets }),
					},
				};
			}
			// Your own prices and "not in budget" always win.
			updateTrip(next);
			saveItinerary(applyTravellerCosts(updated, next));
			clearExchange(); // a budget edit is the only time the exchange rate refreshes
			onClose();
		} catch {
			setError("Couldn't reach the server. Check your connection and try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={apply} noValidate className="flex flex-col gap-6 rounded-[20px] border-2 border-[#0F6B5C] bg-white p-6">
			<div>
				<h2 className={`${heading} m-0 text-lg font-semibold`}>Edit budget</h2>
				<p className="mt-1 text-[15px] text-[#4A4D55]">
					Changes update the budget only. To change activities for a new budget, ask in the box above.
				</p>
			</div>

			<div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
				<div className="flex flex-col gap-2">
					<label htmlFor="edit-budget" className={label}>
						Total budget <span className="font-normal text-[#5B5E66]">· for everyone, not per person</span>
					</label>
					<div className="flex h-12 overflow-hidden rounded-xl border border-[#CFCCC2]">
						<span className="flex items-center border-r border-[#E2E0D8] bg-[#F4F3EF] px-3 text-[15px] text-[#4A4D55]">
							{trip.currency}
						</span>
						<input
							id="edit-budget"
							type="number"
							min={1}
							inputMode="numeric"
							value={Number.isNaN(budget) ? "" : budget}
							onChange={(e) => setBudget(e.target.valueAsNumber)}
							className={cn("min-w-0 flex-1 border-0 px-3.5 text-base text-[#16181D]", focus)}
						/>
					</div>
				</div>

				<CostChoice
					id="edit-stay"
					label="Hotel price"
					mode={stayMode}
					onModeChange={setStayMode}
					currency={trip.currency}
					amount={stayAmount}
					onAmountChange={setStayAmount}
					placeholder="e.g. 120"
					per={
						<>
							<label htmlFor="edit-stay-per" className="sr-only">
								Price is per night or for the whole stay
							</label>
							<select
								id="edit-stay-per"
								value={stayPer}
								onChange={(e) => setStayPer(e.target.value as "night" | "total")}
								className={cn("border-0 border-l border-[#E2E0D8] bg-[#F4F3EF] px-2.5 text-[15px] text-[#16181D]", focus)}
							>
								<option value="night">per night</option>
								<option value="total">total stay</option>
							</select>
						</>
					}
					hint={{
						estimate:
							trip.stay.mode === "estimate"
								? "Keeps the current estimate."
								: "We'll estimate a well-located mid-range stay.",
						manual: `${
							stayPer === "night" && !isBlank(stayAmount) && nights > 0
								? `${formatMoney(stayAmount * nights, trip.currency)} for ${nights} night${nights === 1 ? "" : "s"}. `
								: ""
						}For everyone, not per person. Leave it blank to keep the hotel out of your budget.`,
						excluded: "The hotel won't count towards your budget.",
					}}
				/>

				<CostChoice
					id="edit-tickets"
					label="Flights"
					sublabel="arrival & departure"
					mode={ticketMode}
					onModeChange={setTicketMode}
					currency={trip.currency}
					amount={ticketAmount}
					onAmountChange={setTicketAmount}
					placeholder="Total for everyone"
					hint={{
						estimate: "We'll estimate return economy flights for everyone.",
						manual: "Arrival and departure flights, total for everyone. Leave it blank to keep flights out of your budget.",
						excluded: "Flights won't count towards your budget.",
					}}
				>
					{ticketMode === "estimate" && (
						<div className="flex flex-col gap-2">
							<label htmlFor="edit-origin" className={label}>
								Flying from
							</label>
							<input
								id="edit-origin"
								type="text"
								value={origin}
								maxLength={120}
								onChange={(e) => setOrigin(e.target.value)}
								placeholder="e.g. Jakarta (CGK)"
								className={cn("h-12 w-full rounded-xl border border-[#CFCCC2] bg-white px-3.5 text-base", focus)}
							/>
						</div>
					)}
				</CostChoice>
			</div>

			{error && (
				<p role="alert" className="m-0 rounded-xl bg-[#FDECEA] px-4 py-3 text-sm font-medium text-[#9F1D14]">
					{error}
				</p>
			)}

			<div className="flex flex-wrap items-center gap-3">
				<button
					type="submit"
					disabled={busy}
					style={{ background: ACCENT }}
					className={cn(
						"flex min-h-12 cursor-pointer items-center rounded-xl px-6 text-[15px] font-semibold text-white disabled:cursor-wait disabled:opacity-60",
						focus,
					)}
				>
					{busy ? "Estimating…" : "Update budget"}
				</button>
				<button
					type="button"
					onClick={onClose}
					disabled={busy}
					className={cn("min-h-12 cursor-pointer rounded-xl px-4 text-[15px] font-semibold text-[#4A4D55] hover:text-[#16181D]", focus)}
				>
					Cancel
				</button>
			</div>
		</form>
	);
}
