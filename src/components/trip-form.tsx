"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
	CURRENCIES,
	INTERESTS,
	PACES,
	TRAVELLERS,
	TripInputSchema,
	tripDayCount,
	type TripInput,
} from "@/lib/itinerary-schema";
import { saveTrip } from "@/lib/trip-session";

const ACCENT = "#0F6B5C";
const CURRENCY_LABELS: Record<TripInput["currency"], string> = {
	EUR: "EUR €",
	GBP: "GBP £",
	USD: "USD $",
};

const label = "text-sm font-semibold";
const focus = "focus:outline-2 focus:outline-offset-1 focus:outline-[#0F6B5C]";
const field = cn(
	"h-12 rounded-xl border border-[#CFCCC2] bg-white text-base text-[#16181D]",
	focus,
);

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
	});
	const [error, setError] = useState<string | null>(null);

	const update = <K extends keyof TripInput>(key: K, value: TripInput[K]) =>
		setTrip((t) => ({ ...t, [key]: value }));

	const toggleInterest = (interest: TripInput["interests"][number]) =>
		update(
			"interests",
			trip.interests.includes(interest)
				? trip.interests.filter((i) => i !== interest)
				: [...trip.interests, interest],
		);

	const days = trip.startDate && trip.endDate ? tripDayCount(trip) : 0;
	const lengthLabel =
		days >= 1
			? `${days} day${days === 1 ? "" : "s"} · ${days - 1} night${days - 1 === 1 ? "" : "s"}`
			: "Pick your dates";

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		// Same schema the server uses, so the user gets instant feedback.
		const result = TripInputSchema.safeParse(trip);
		if (!result.success) {
			setError(result.error.issues[0]?.message ?? "Check your trip details");
			return;
		}
		setError(null);
		saveTrip(result.data);
		router.push("/generating");
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			className="flex min-w-0 flex-[1_1_520px] flex-col gap-6 rounded-[20px] border border-[#E2E0D8] bg-white p-8 shadow-[0_1px_2px_rgba(22,24,29,0.04),0_12px_32px_rgba(22,24,29,0.06)]"
		>
			<h2 className="m-0 font-[family-name:var(--font-space-grotesk)] text-[22px] font-semibold">
				Trip details
			</h2>

			{/* Destination */}
			<div className="flex flex-col gap-2">
				<label htmlFor="dest" className={label}>
					Destination
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

			{/* Budget + travellers */}
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
				<div className="flex flex-col gap-2">
					<label htmlFor="budget" className={label}>
						Total budget
					</label>
					<div className="flex h-12 overflow-hidden rounded-xl border border-[#CFCCC2]">
						<select
							aria-label="Currency"
							value={trip.currency}
							onChange={(e) => update("currency", e.target.value as TripInput["currency"])}
							className={cn(
								"border-0 border-r border-[#E2E0D8] bg-[#F4F3EF] px-2.5 text-[15px] text-[#16181D]",
								focus,
							)}
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
				<div role="group" aria-labelledby="pace-label" className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#F4F3EF] p-1">
					{PACES.map((p) => {
						const on = trip.pace === p;
						return (
							<button
								key={p}
								type="button"
								aria-pressed={on}
								onClick={() => update("pace", p)}
								className={cn(
									"h-11 cursor-pointer rounded-[9px] border-0 text-[15px] font-semibold",
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
