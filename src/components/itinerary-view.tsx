"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { dateRangeLabel, dayLabel, formatMoney } from "@/lib/itinerary-schema";
import { useStoredItinerary, useStoredTrip } from "@/lib/trip-session";

const ACCENT = "#0F6B5C";

const heading = "font-[family-name:var(--font-space-grotesk)]";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6B5C]";
const card = "rounded-[20px] border border-[#E2E0D8] bg-white";

export function ItineraryView() {
	const router = useRouter();
	const trip = useStoredTrip();
	const itinerary = useStoredItinerary();
	const [selected, setSelected] = useState(0);
	const [shareNotice, setShareNotice] = useState(false);

	// Nothing generated in this tab yet: start from the form.
	useEffect(() => {
		if (trip === null || itinerary === null) router.replace("/");
	}, [trip, itinerary, router]);

	if (!trip || !itinerary || itinerary.days.length === 0) return null;

	const money = (n: number) => formatMoney(n, trip.currency);
	const dayIndex = Math.min(selected, itinerary.days.length - 1);
	const day = itinerary.days[dayIndex];
	const dayCost = day.items.reduce((sum, it) => sum + it.cost, 0);

	const { stay, food, activities, transport } = itinerary.budget;
	const total = stay + food + activities + transport;
	const overBudget = total > trip.budget;
	const usedPct = Math.min(100, Math.round((total / trip.budget) * 100));
	const n = itinerary.days.length;

	return (
		<main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 pt-10 pb-20">
			{/* Title + actions */}
			<section className="flex flex-wrap items-end justify-between gap-6">
				<div className="flex min-w-0 flex-col gap-2.5">
					<span className="flex items-center gap-1.5 self-start rounded-full bg-[#DDEEE9] px-2.5 py-1 text-[13px] font-semibold text-[#0F5E52]">
						<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#0F5E52" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						Itinerary ready
					</span>
					<h1 className={`${heading} m-0 text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.05] font-bold tracking-[-0.02em]`}>
						{n} day{n === 1 ? "" : "s"} in {itinerary.destinationName}
					</h1>
					<div className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] text-[#4A4D55]">
						<span>{dateRangeLabel(trip)}</span>
						<span>{trip.travellers}</span>
						<span>{trip.pace} pace</span>
					</div>
				</div>
				<div className="flex flex-wrap gap-2.5">
					<button
						type="button"
						disabled
						title="PDF export is coming next"
						className={cn(
							"flex min-h-12 cursor-not-allowed items-center gap-2 rounded-xl border border-[#CFCCC2] bg-white px-5 text-[15px] font-semibold text-[#16181D] opacity-60",
							focus,
						)}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="#16181D" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						Export PDF
					</button>
					<button
						type="button"
						onClick={() => setShareNotice(true)}
						style={{ background: ACCENT }}
						className={cn(
							"flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-0 px-5 text-[15px] font-semibold text-white",
							focus,
						)}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" />
						</svg>
						Share link
					</button>
				</div>
			</section>

			{/* Share links need storage, which isn't built yet. */}
			{shareNotice && (
				<div role="status" className="flex flex-wrap items-center gap-3 rounded-[14px] bg-[#16181D] py-3 pr-3 pl-5 text-white">
					<span className="font-semibold">Share links are coming soon</span>
					<span className="flex-1 text-sm text-[#C9CBD1]">For now, this itinerary lives in this browser tab only.</span>
					<button
						type="button"
						onClick={() => setShareNotice(false)}
						aria-label="Dismiss"
						className={cn("flex size-11 cursor-pointer items-center justify-center border-0 bg-transparent", focus)}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M6 6l12 12M18 6L6 18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
						</svg>
					</button>
				</div>
			)}

			<div className="flex flex-wrap items-start gap-6">
				<section className="flex min-w-0 flex-[999_1_600px] flex-col gap-5">
					{/* Day tabs */}
					<div role="tablist" aria-label="Days" className="flex gap-2 overflow-x-auto pb-1">
						{itinerary.days.map((_, i) => {
							const on = i === dayIndex;
							return (
								<button
									key={i}
									type="button"
									role="tab"
									aria-selected={on}
									onClick={() => setSelected(i)}
									className={cn(
										"min-h-14 min-w-[120px] flex-none cursor-pointer rounded-[14px] border px-4 py-2 text-left",
										on ? "border-[#16181D] bg-[#16181D] text-white" : "border-[#E2E0D8] bg-white text-[#16181D]",
										focus,
									)}
								>
									<span className="block text-xs font-semibold tracking-[0.06em] uppercase opacity-80">Day {i + 1}</span>
									<span className="block text-[15px] font-semibold">{dayLabel(trip.startDate, i)}</span>
								</button>
							);
						})}
					</div>

					{/* Selected day */}
					<article role="tabpanel" className={cn(card, "flex flex-col gap-6 p-7")}>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<div className="text-[13px] font-semibold tracking-[0.06em] text-[#5B5E66] uppercase">
									Day {dayIndex + 1} · {dayLabel(trip.startDate, dayIndex)}
								</div>
								<h2 className={`${heading} mt-1 text-[28px] font-semibold tracking-[-0.01em]`}>{day.title}</h2>
								<p className="mt-1.5 max-w-[36rem] text-[#4A4D55]">{day.summary}</p>
							</div>
							<div className="flex-none text-right">
								<div className="text-[13px] text-[#5B5E66]">Est. for the day</div>
								<div className={`${heading} text-2xl font-semibold`}>{money(dayCost)}</div>
							</div>
						</div>

						<ol className="m-0 flex list-none flex-col p-0">
							{day.items.map((it, i) => (
								<li key={i} className="grid grid-cols-[64px_20px_minmax(0,1fr)] gap-x-3.5">
									<span className="pt-0.5 text-sm font-semibold text-[#4A4D55]">{it.time}</span>
									<span className="flex flex-col items-center">
										<span style={{ borderColor: ACCENT }} className="mt-1.5 size-3 rounded-full border-[3px] bg-white" />
										<span className="my-1 w-0.5 flex-1 bg-[#E2E0D8]" />
									</span>
									<div className="flex flex-col gap-1.5 pb-6">
										<div className="flex flex-wrap items-baseline justify-between gap-2">
											<h3 className="m-0 text-[17px] font-semibold">{it.title}</h3>
											<span className="text-sm text-[#4A4D55]">{money(it.cost)}</span>
										</div>
										<p className="m-0 text-[15px] text-[#4A4D55]">{it.description}</p>
										<span className="self-start rounded-md bg-[#F4F3EF] px-2 py-0.5 text-xs font-semibold text-[#4A4D55]">
											{it.tag}
										</span>
									</div>
								</li>
							))}
						</ol>
					</article>
				</section>

				{/* Sidebar */}
				<aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
					<section className={cn(card, "flex flex-col gap-4 p-6")}>
						<h2 className={`${heading} m-0 text-lg font-semibold`}>Budget</h2>
						<div className="flex items-baseline gap-2">
							<span className={`${heading} text-[34px] font-bold`}>{money(total)}</span>
							<span className={overBudget ? "font-semibold text-[#9F1D14]" : "text-[#4A4D55]"}>
								of {money(trip.budget)}
								{overBudget ? " (over budget)" : ""}
							</span>
						</div>
						<div
							role="img"
							aria-label={`${money(total)} of ${money(trip.budget)} budget used`}
							className="h-2.5 overflow-hidden rounded-full bg-[#E2E0D8]"
						>
							<div className="h-full" style={{ width: `${usedPct}%`, background: overBudget ? "#9F1D14" : ACCENT }} />
						</div>
						<dl className="m-0 flex flex-col gap-2.5 text-[15px]">
							{(
								[
									[`Stay (${Math.max(n - 1, 0)} night${n - 1 === 1 ? "" : "s"})`, stay],
									["Food & drink", food],
									["Activities", activities],
									["Getting around", transport],
								] as const
							).map(([k, v]) => (
								<div key={k} className="flex justify-between">
									<dt className="text-[#4A4D55]">{k}</dt>
									<dd className="m-0 font-semibold">{money(v)}</dd>
								</div>
							))}
						</dl>
						<p className="m-0 text-[13px] text-[#5B5E66]">Estimates generated by AI. Check prices before booking.</p>
					</section>

					{itinerary.tips.length > 0 && (
						<section className={cn(card, "flex flex-col gap-3.5 p-6")}>
							<h2 className={`${heading} m-0 text-lg font-semibold`}>Good to know</h2>
							<ul className="m-0 flex list-disc flex-col gap-2.5 py-0 pr-0 pl-[18px] text-[15px] text-[#33363D]">
								{itinerary.tips.map((tip, i) => (
									<li key={i}>{tip}</li>
								))}
							</ul>
						</section>
					)}
				</aside>
			</div>
		</main>
	);
}
