"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
	CURRENCIES,
	INTERESTS,
	PACES,
	firstStopNights,
	formatMoney,
	MAX_EXTRA_STOPS,
	TRANSIT_LEGS,
	TRAVELLERS,
	TripInputSchema,
	tripDayCount,
	type TripInput,
} from "@/lib/itinerary-schema";
import { saveTrip } from "@/lib/trip-session";
import { CostChoice, isBlank, type CostMode } from "./cost-choice";

const ACCENT = "#0F6B5C";
const CURRENCY_LABELS: Record<TripInput["currency"], string> = {
	EUR: "EUR €",
	GBP: "GBP £",
	USD: "USD $",
	IDR: "IDR Rp",
};

const label = "text-sm font-semibold";
const focus = "focus:outline-2 focus:outline-offset-1 focus:outline-[#0F6B5C]";
const field = cn("h-12 rounded-xl border border-[#CFCCC2] bg-white text-base text-[#16181D]", focus);

function CalendarIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			aria-hidden="true"
			className="pointer-events-none absolute top-[15px] left-3.5"
		>
			<rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="#5B5E66" strokeWidth="1.8" />
			<path d="M3.5 10h17M8 3v4M16 3v4" stroke="#5B5E66" strokeWidth="1.8" strokeLinecap="round" />
		</svg>
	);
}

export function TripForm() {
	const router = useRouter();
	const [trip, setTrip] = useState<TripInput>({
		destination: "Lisbon, Portugal",
		startDate: "2027-05-14",
		endDate: "2027-05-17",
		currency: "EUR",
		budget: 1200,
		travellers: "2 adults",
		interests: ["Food & drink", "History", "Viewpoints"],
		pace: "Balanced",
		notes: "Vegetarian. Would love one day trip outside the city.",
		mustSee: [],
		stay: { mode: "estimate" },
		travelTickets: { mode: "excluded" },
		origin: "",
		stops: [],
		tripType: "single",
		transit: null,
	});
	const [transitPlace, setTransitPlace] = useState("");
	const [transitLeg, setTransitLeg] = useState<(typeof TRANSIT_LEGS)[number]>("outbound");
	const [error, setError] = useState<string | null>(null);
	// Hotel and tickets: Claude estimates, you enter a price, or it's not in the budget.
	const [stayMode, setStayMode] = useState<CostMode>("estimate");
	const [stayAmount, setStayAmount] = useState<number>(Number.NaN);
	const [stayPer, setStayPer] = useState<"night" | "total">("night");
	const [ticketMode, setTicketMode] = useState<CostMode>("excluded");
	const [ticketAmount, setTicketAmount] = useState<number>(Number.NaN);

	const update = <K extends keyof TripInput>(key: K, value: TripInput[K]) => setTrip((t) => ({ ...t, [key]: value }));

	const updateStop = (index: number, patch: Partial<TripInput["stops"][number]>) =>
		update(
			"stops",
			trip.stops.map((s, i) => (i === index ? { ...s, ...patch } : s)),
		);

	const toggleInterest = (interest: TripInput["interests"][number]) =>
		update(
			"interests",
			trip.interests.includes(interest) ? trip.interests.filter((i) => i !== interest) : [...trip.interests, interest],
		);

	const days = trip.startDate && trip.endDate ? tripDayCount(trip) : 0;
	const firstNights = days >= 1 ? firstStopNights(trip) : 0;
	const lengthLabel =
		days >= 1
			? `${days} day${days === 1 ? "" : "s"} · ${days - 1} night${days - 1 === 1 ? "" : "s"}`
			: "Pick your dates";

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		// Same schema the server uses, so the user gets instant feedback.
		const result = TripInputSchema.safeParse({
			...trip,
			// Only the chosen trip type's details are sent.
			stops: trip.tripType === "multi" ? trip.stops : [],
			transit:
				trip.tripType === "transit" ? (transitPlace.trim() ? { place: transitPlace, leg: transitLeg } : null) : null,
			// A blank (or 0) price counts as "not in budget" instead of blocking the form.
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
			setError(result.error.issues[0]?.message ?? "Check your trip details");
			return;
		}
		setError(null);
		saveTrip(result.data);
		router.push("/places");
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			className="flex min-w-0 flex-[1_1_520px] flex-col gap-6 rounded-[20px] border border-[#E2E0D8] bg-white p-8 shadow-[0_1px_2px_rgba(22,24,29,0.04),0_12px_32px_rgba(22,24,29,0.06)]"
		>
			<h2 className="m-0 font-[family-name:var(--font-space-grotesk)] text-[22px] font-semibold">Trip details</h2>

			{/* Trip type */}
			<div className="flex flex-col gap-2">
				<span id="trip-type-label" className={label}>
					Trip type
				</span>
				<div
					role="group"
					aria-labelledby="trip-type-label"
					className="grid grid-cols-1 gap-1.5 rounded-xl bg-[#F4F3EF] p-1 sm:grid-cols-3"
				>
					{(
						[
							["single", "Single destination"],
							["transit", "With a transit stop"],
							["multi", "Multiple destinations"],
						] as const
					).map(([type, text]) => {
						const on = trip.tripType === type;
						return (
							<button
								key={type}
								type="button"
								aria-pressed={on}
								onClick={() =>
									setTrip((t) => ({
										...t,
										tripType: type,
										// Start the route with one empty stop to fill in.
										stops: type === "multi" && t.stops.length === 0 ? [{ place: "", nights: 1 }] : t.stops,
									}))
								}
								className={cn(
									"min-h-11 cursor-pointer rounded-[9px] border-0 px-2 text-[15px] font-semibold",
									on
										? "bg-white text-[#16181D] shadow-[0_1px_3px_rgba(22,24,29,0.12)]"
										: "bg-transparent text-[#5B5E66]",
									focus,
								)}
							>
								{text}
							</button>
						);
					})}
				</div>
			</div>

			{/* Destination */}
			<div className="flex flex-col gap-2">
				<label htmlFor="dest" className={label}>
					{trip.tripType === "multi" ? "First destination" : "Destination"}
				</label>
				<div className="relative">
					<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="absolute top-3.5 left-3.5">
						<path
							d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"
							fill="none"
							stroke="#5B5E66"
							strokeWidth="1.8"
						/>
						<circle cx="12" cy="9.5" r="2.5" fill="none" stroke="#5B5E66" strokeWidth="1.8" />
					</svg>
					<input
						id="dest"
						type="text"
						required
						value={trip.destination}
						onChange={(e) => update("destination", e.target.value)}
						placeholder="City, region or country"
						className={cn(field, "w-full pr-3.5 pl-11")}
					/>
				</div>
			</div>

			{/* Transit stop (layover, no overnight) */}
			{trip.tripType === "transit" && (
				<div className="-mt-2 flex flex-col gap-2">
					<label htmlFor="transit-place" className={label}>
						Transit via
					</label>
					<div className="flex flex-wrap gap-2">
						<input
							id="transit-place"
							type="text"
							value={transitPlace}
							maxLength={120}
							onChange={(e) => setTransitPlace(e.target.value)}
							placeholder="e.g. Singapore"
							className={cn(field, "min-w-[180px] flex-1 px-3.5")}
						/>
						<label htmlFor="transit-leg" className="sr-only">
							When you transit
						</label>
						<select
							id="transit-leg"
							value={transitLeg}
							onChange={(e) => setTransitLeg(e.target.value as (typeof TRANSIT_LEGS)[number])}
							className={cn(field, "px-3")}
						>
							<option value="outbound">On the way there</option>
							<option value="return">On the way back</option>
							<option value="both">Both ways</option>
						</select>
					</div>
					<p className="m-0 text-sm text-[#5B5E66]">
						A connection or layover with no overnight stay. Staying a night or more? Choose Multiple destinations.
					</p>
				</div>
			)}

			{/* Dates */}
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
				{(
					[
						{ id: "start", text: "Arrive", key: "startDate" },
						{ id: "end", text: "Leave", key: "endDate" },
					] as const
				).map((d) => (
					<div key={d.id} className="flex flex-col gap-2">
						<label htmlFor={d.id} className={label}>
							{d.text}
						</label>
						<div className="relative">
							<CalendarIcon />
							<input
								id={d.id}
								type="date"
								required
								value={trip[d.key]}
								min={d.key === "endDate" ? trip.startDate : undefined}
								onChange={(e) => update(d.key, e.target.value)}
								className={cn(field, "w-full pr-3.5 pl-10")}
							/>
						</div>
					</div>
				))}
			</div>
			<p className="-mt-3 text-sm text-[#5B5E66]">{lengthLabel}</p>

			{/* More destinations (multi-stop trips) */}
			{trip.tripType === "multi" && (
				<div className="-mt-2 flex flex-col gap-3">
					{trip.stops.length > 0 && (
						<>
							<span className={label}>
								Route <span className="font-normal text-[#5B5E66]">· we&apos;ll plan the travel between stops</span>
							</span>
							<ol className="m-0 flex list-none flex-col gap-2 p-0">
								<li className="flex items-center gap-3 rounded-xl bg-[#F4F3EF] px-3.5 py-2.5 text-[15px]">
									<span className="flex size-6 flex-none items-center justify-center rounded-full bg-[#16181D] text-[12px] font-semibold text-white">
										1
									</span>
									<span className="min-w-0 flex-1 truncate font-medium">{trip.destination || "First destination"}</span>
									<span
										className={cn(
											"text-sm whitespace-nowrap",
											firstNights < 1 ? "font-semibold text-[#9F1D14]" : "text-[#4A4D55]",
										)}
									>
										{firstNights} night{firstNights === 1 ? "" : "s"} · the rest
									</span>
								</li>
								{trip.stops.map((stop, i) => (
									<li key={i} className="flex items-center gap-2">
										<span className="ml-3.5 flex size-6 flex-none items-center justify-center rounded-full bg-[#16181D] text-[12px] font-semibold text-white">
											{i + 2}
										</span>
										<label htmlFor={`stop-${i}`} className="sr-only">
											Destination {i + 2}
										</label>
										<input
											id={`stop-${i}`}
											type="text"
											value={stop.place}
											maxLength={120}
											onChange={(e) => updateStop(i, { place: e.target.value })}
											placeholder="e.g. Porto"
											className={cn(field, "min-w-0 flex-1 px-3.5")}
										/>
										<label htmlFor={`stop-nights-${i}`} className="sr-only">
											Nights in destination {i + 2}
										</label>
										<div className="flex h-12 flex-none items-center overflow-hidden rounded-xl border border-[#CFCCC2]">
											<input
												id={`stop-nights-${i}`}
												type="number"
												min={1}
												inputMode="numeric"
												value={Number.isNaN(stop.nights) ? "" : stop.nights}
												onChange={(e) => updateStop(i, { nights: e.target.valueAsNumber })}
												className={cn("h-full w-14 border-0 px-2 text-center text-base", focus)}
											/>
											<span className="h-full bg-[#F4F3EF] px-2.5 text-sm leading-[46px] text-[#4A4D55]">nights</span>
										</div>
										<button
											type="button"
											onClick={() =>
												update(
													"stops",
													trip.stops.filter((_, j) => j !== i),
												)
											}
											aria-label={`Remove destination ${i + 2}`}
											className={cn(
												"flex size-11 flex-none cursor-pointer items-center justify-center rounded-xl hover:bg-[#F4F3EF]",
												focus,
											)}
										>
											<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
												<path d="M6 6l12 12M18 6L6 18" stroke="#5B5E66" strokeWidth="2.2" strokeLinecap="round" />
											</svg>
										</button>
									</li>
								))}
							</ol>
							{firstNights < 1 && (
								<p className="m-0 text-sm font-medium text-[#9F1D14]">
									Leave at least 1 night for {trip.destination || "your first destination"}, or pick later dates.
								</p>
							)}
						</>
					)}
					{trip.stops.length < MAX_EXTRA_STOPS && (
						<button
							type="button"
							onClick={() => update("stops", [...trip.stops, { place: "", nights: 1 }])}
							className={cn(
								"flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-xl px-1 text-[15px] font-semibold text-[#0F5E52] hover:underline",
								focus,
							)}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
								<path d="M12 5v14M5 12h14" stroke="#0F5E52" strokeWidth="2.2" strokeLinecap="round" />
							</svg>
							Add another destination
						</button>
					)}
				</div>
			)}

			{/* Budget + travellers */}
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
				<div className="flex flex-col gap-2">
					<label htmlFor="budget" className={label}>
						Total budget <span className="font-normal text-[#5B5E66]">· for everyone, not per person</span>
					</label>
					<div className="flex h-12 overflow-hidden rounded-xl border border-[#CFCCC2]">
						<select
							aria-label="Currency"
							value={trip.currency}
							onChange={(e) => update("currency", e.target.value as TripInput["currency"])}
							className={cn("border-0 border-r border-[#E2E0D8] bg-[#F4F3EF] px-2.5 text-[15px] text-[#16181D]", focus)}
						>
							{CURRENCIES.map((c) => (
								<option key={c} value={c}>
									{CURRENCY_LABELS[c]}
								</option>
							))}
						</select>
						<input
							id="budget"
							type="number"
							min={1}
							inputMode="numeric"
							value={Number.isNaN(trip.budget) ? "" : trip.budget}
							onChange={(e) => update("budget", e.target.valueAsNumber)}
							className={cn("min-w-0 flex-1 border-0 px-3.5 text-base text-[#16181D]", focus)}
						/>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<label htmlFor="people" className={label}>
						Travellers
					</label>
					<select
						id="people"
						value={trip.travellers}
						onChange={(e) => update("travellers", e.target.value as TripInput["travellers"])}
						className={cn(field, "px-3")}
					>
						{TRAVELLERS.map((t) => (
							<option key={t}>{t}</option>
						))}
					</select>
				</div>
			</div>

			{/* Hotel price */}
			<CostChoice
				id="stay"
				label="Hotel price"
				mode={stayMode}
				onModeChange={setStayMode}
				currency={trip.currency}
				amount={stayAmount}
				onAmountChange={setStayAmount}
				placeholder="e.g. 120"
				per={
					<>
						<label htmlFor="stay-per" className="sr-only">
							Price is per night or for the whole stay
						</label>
						<select
							id="stay-per"
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
					estimate: "We'll estimate a well-located mid-range stay within your budget.",
					manual: `${
						stayPer === "night" && !Number.isNaN(stayAmount) && days > 1
							? `${formatMoney(stayAmount * (days - 1), trip.currency)} for ${days - 1} night${days - 1 === 1 ? "" : "s"}. `
							: ""
					}For everyone, not per person. Leave it blank to keep the hotel out of your budget.`,
					excluded: "Staying with friends or paying separately? Your budget won't include accommodation.",
				}}
			/>

			{/* Flights (arrival & departure) */}
			<CostChoice
				id="tickets"
				label="Flights"
				sublabel="arrival & departure"
				mode={ticketMode}
				onModeChange={setTicketMode}
				currency={trip.currency}
				amount={ticketAmount}
				onAmountChange={setTicketAmount}
				placeholder="Total for everyone"
				hint={{
					estimate: "We'll estimate return economy flights for everyone. They come out of your budget.",
					manual:
						"Arrival and departure flights, total for everyone. Leave it blank to keep flights out of your budget.",
					excluded: "Already booked or paying separately? Your budget won't include flights.",
				}}
			>
				{ticketMode === "estimate" && (
					<div className="flex flex-col gap-2">
						<label htmlFor="origin" className={label}>
							Flying from
						</label>
						<input
							id="origin"
							type="text"
							value={trip.origin}
							maxLength={120}
							onChange={(e) => update("origin", e.target.value)}
							placeholder="e.g. Jakarta (CGK)"
							className={cn(field, "w-full px-3.5")}
						/>
					</div>
				)}
			</CostChoice>

			{/* Interests */}
			<fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
				<legend className="mb-2.5 p-0 text-sm font-semibold">
					Interests <span className="font-normal text-[#5B5E66]">· pick any</span>
				</legend>
				<div className="flex flex-wrap gap-2">
					{INTERESTS.map((interest) => {
						const on = trip.interests.includes(interest);
						return (
							<button
								key={interest}
								type="button"
								aria-pressed={on}
								onClick={() => toggleInterest(interest)}
								style={{
									borderColor: on ? ACCENT : "#CFCCC2",
									background: on ? ACCENT : "#FFFFFF",
									color: on ? "#FFFFFF" : "#16181D",
								}}
								className={cn("min-h-11 cursor-pointer rounded-full border px-4 text-[15px] font-medium", focus)}
							>
								{interest}
							</button>
						);
					})}
				</div>
			</fieldset>

			{/* Pace */}
			<div className="flex flex-col gap-2">
				<span id="pace-label" className={label}>
					Pace
				</span>
				<div
					role="group"
					aria-labelledby="pace-label"
					className="grid grid-cols-4 gap-1 rounded-xl bg-[#F4F3EF] p-1 sm:gap-1.5"
				>
					{PACES.map((p) => {
						const on = trip.pace === p;
						return (
							<button
								key={p}
								type="button"
								aria-pressed={on}
								onClick={() => update("pace", p)}
								className={cn(
									"h-11 min-w-0 cursor-pointer rounded-[9px] border-0 px-1 text-sm font-semibold sm:text-[15px]",
									on
										? "bg-white text-[#16181D] shadow-[0_1px_3px_rgba(22,24,29,0.12)]"
										: "bg-transparent text-[#5B5E66]",
									focus,
								)}
							>
								{p}
							</button>
						);
					})}
				</div>
			</div>

			{/* Notes */}
			<div className="flex flex-col gap-2">
				<label htmlFor="notes" className={label}>
					Anything else? <span className="font-normal text-[#5B5E66]">· optional</span>
				</label>
				<textarea
					id="notes"
					rows={3}
					maxLength={1000}
					placeholder="Dietary needs, must-sees, mobility, travelling with kids…"
					value={trip.notes}
					onChange={(e) => update("notes", e.target.value)}
					className={cn("resize-y rounded-xl border border-[#CFCCC2] px-3.5 py-3 text-base text-[#16181D]", focus)}
				/>
			</div>

			{error && (
				<p role="alert" className="-mb-2 rounded-xl bg-[#FDECEA] px-4 py-3 text-sm font-medium text-[#9F1D14]">
					{error}
				</p>
			)}

			<button
				type="submit"
				style={{ background: ACCENT }}
				className={cn(
					"flex h-14 cursor-pointer items-center justify-center gap-2.5 rounded-[14px] text-[17px] font-semibold text-white",
					focus,
				)}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"
						fill="none"
						stroke="#FFFFFF"
						strokeWidth="1.8"
						strokeLinejoin="round"
					/>
				</svg>
				Generate itinerary
			</button>
			<p className="-mt-2 text-center text-[13px] text-[#5B5E66]">
				Usually ready in under a minute. Prices are estimates. Check before booking.
			</p>
		</form>
	);
}
