"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
	dateRangeLabel,
	dayLabel,
	formatMoney,
	tripDayCount,
	type PartialItinerary,
	type StreamEvent,
	type TripInput,
} from "@/lib/itinerary-schema";
import { saveItinerary, useStoredTrip } from "@/lib/trip-session";

const heading = "font-[family-name:var(--font-space-grotesk)]";
const dayLabelCls = "text-[13px] font-semibold tracking-[0.06em] uppercase";
const slotLabel = "w-[76px] flex-none text-sm font-semibold text-[#5B5E66]";
const skeleton = "rounded-md bg-[#ECEAE4]";

type PartialDay = NonNullable<PartialItinerary["days"]>[number];

export function GeneratingView() {
	const router = useRouter();
	const trip = useStoredTrip();
	const [partial, setPartial] = useState<PartialItinerary | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);

	// No trip in this tab (e.g. page opened directly): go back to the form.
	useEffect(() => {
		if (trip === null) router.replace("/");
	}, [trip, router]);

	// Call the API and read the streamed itinerary line by line.
	useEffect(() => {
		if (!trip) return;
		const controller = new AbortController();

		(async () => {
			try {
				const res = await fetch("/api/itinerary", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(trip),
					signal: controller.signal,
				});
				if (!res.ok || !res.body) {
					const body = await res.json().catch(() => null);
					setError(body?.error ?? "Couldn't start planning. Please try again.");
					return;
				}

				const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
				let buffer = "";
				let finished = false;
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					buffer += value;
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? ""; // keep any incomplete line for next time
					for (const line of lines) {
						if (!line.trim()) continue;
						const event = JSON.parse(line) as StreamEvent;
						if (event.type === "partial") {
							setPartial(event.itinerary);
						} else if (event.type === "done") {
							finished = true;
							saveItinerary(event.itinerary);
							router.push("/itinerary");
						} else {
							finished = true;
							setError(event.message);
						}
					}
				}
				if (!finished) setError("The connection dropped before the plan finished. Please try again.");
			} catch {
				if (!controller.signal.aborted) {
					setError("Couldn't reach the server. Check your connection and try again.");
				}
			}
		})();

		// Leaving the page (or Cancel) aborts the request, which also stops Claude.
		return () => controller.abort();
	}, [trip, attempt, router]);

	if (!trip) return null;

	const totalDays = tripDayCount(trip);
	const days = partial?.days ?? [];
	const budgetStarted = partial?.budget !== undefined;
	// A day is finished once the next one has started (or the budget has).
	const readyCount = budgetStarted ? days.length : Math.max(days.length - 1, 0);
	const current = budgetStarted ? undefined : days[days.length - 1];
	const currentIndex = current ? days.length - 1 : -1;
	const progress = Math.min(
		100,
		Math.round(((readyCount + (current ? 0.5 : 0)) / totalDays) * 95 + (budgetStarted ? 5 : 0)),
	);

	return (
		<main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 pt-10 pb-20">
			<section className="flex flex-wrap items-end justify-between gap-6">
				<div className="flex flex-col gap-2">
					{error ? (
						<span className="text-sm font-semibold text-[#9F1D14]">Planning stopped</span>
					) : (
						<span className="flex items-center gap-2 text-sm font-semibold text-[#0F5E52]">
							<span className="animate-soft-pulse size-2 rounded-full bg-[#0F6B5C]" />
							Planning your trip…
						</span>
					)}
					<h1 className={`${heading} m-0 text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-bold tracking-[-0.02em]`}>
						{trip.destination}
					</h1>
					<p className="m-0 text-[#4A4D55]">{tripSummary(trip)}</p>
				</div>
				<div className="flex min-w-[240px] flex-[0_1_320px] flex-col gap-2">
					<div className="flex justify-between text-sm">
						<span className="font-semibold">
							{days.length === 0
								? "Getting started"
								: budgetStarted
									? "Checking the budget"
									: `Day ${days.length} of ${totalDays}`}
						</span>
						<span className="text-[#5B5E66]">Usually under a minute</span>
					</div>
					<div
						role="progressbar"
						aria-label="Itinerary progress"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={progress}
						className="h-2 overflow-hidden rounded-full bg-[#E2E0D8]"
					>
						<div className="h-full rounded-full bg-[#0F6B5C] transition-[width] duration-500" style={{ width: `${progress}%` }} />
					</div>
				</div>
			</section>

			{error && (
				<div role="alert" className="flex flex-wrap items-center gap-3 rounded-[14px] bg-[#FDECEA] px-5 py-4 text-[#9F1D14]">
					<span className="flex-1 font-medium">{error}</span>
					<button
						type="button"
						onClick={() => {
							setError(null);
							setPartial(null);
							setAttempt((a) => a + 1);
						}}
						className="min-h-11 cursor-pointer rounded-xl bg-[#9F1D14] px-4 text-[15px] font-semibold text-white"
					>
						Try again
					</button>
					<Link href="/" className="flex min-h-11 items-center px-2 text-[15px] font-semibold text-[#9F1D14]">
						Edit trip
					</Link>
				</div>
			)}

			<div className="flex flex-wrap items-start gap-6">
				<section className="flex min-w-0 flex-[999_1_560px] flex-col gap-4" aria-live="polite">
					{days.map((day, i) =>
						i === currentIndex ? (
							<DayCard key={i} day={day} label={`Day ${i + 1} · ${dayLabel(trip.startDate, i)}`} writing />
						) : (
							<DayCard key={i} day={day} label={`Day ${i + 1} · ${dayLabel(trip.startDate, i)}`} />
						),
					)}
					{Array.from({ length: Math.max(totalDays - days.length, 0) }, (_, k) => {
						const i = days.length + k;
						return (
							<article
								key={`pending-${i}`}
								aria-hidden="true"
								className="flex flex-col gap-3.5 rounded-[18px] border border-dashed border-[#CFCCC2] bg-[#FAFAF8] p-6"
							>
								<div className={cn(dayLabelCls, "text-[#6B6E76]")}>
									Day {i + 1} · {dayLabel(trip.startDate, i)}
								</div>
								<div className={cn(skeleton, "h-[18px] w-[40%]")} />
								<div className={cn(skeleton, "h-3 w-[85%]")} />
								<div className={cn(skeleton, "h-3 w-[70%]")} />
							</article>
						);
					})}
				</section>

				<aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4 rounded-[18px] border border-[#E2E0D8] bg-white p-6">
					<h2 className={`${heading} m-0 text-lg font-semibold`}>Progress</h2>
					<ol className="m-0 flex list-none flex-col gap-3.5 p-0">
						<Step label="Reading your preferences" state={partial ? "done" : "active"} />
						{Array.from({ length: totalDays }, (_, i) => (
							<Step
								key={i}
								label={days[i]?.title ? `Day ${i + 1} · ${days[i]!.title}` : `Day ${i + 1}`}
								state={i < readyCount ? "done" : i === currentIndex ? "active" : "todo"}
							/>
						))}
						<Step label="Budget check" state={budgetStarted ? "active" : "todo"} />
					</ol>
					<p className="m-0 border-t border-[#E2E0D8] pt-4 text-sm text-[#5B5E66]">
						You can read days as they arrive. PDF export and share links unlock when the plan is finished.
					</p>
				</aside>
			</div>
		</main>
	);
}

function DayCard({ day, label, writing = false }: { day: PartialDay; label: string; writing?: boolean }) {
	const items = day.items ?? [];
	return (
		<article
			className={cn(
				"flex flex-col gap-4 rounded-[18px] bg-white p-6",
				writing ? "border-2 border-[#0F6B5C]" : "border border-[#E2E0D8]",
			)}
		>
			<div className="flex items-center justify-between gap-3">
				<div>
					<div className={cn(dayLabelCls, "text-[#5B5E66]")}>{label}</div>
					<h2 className={`${heading} mt-0.5 text-[22px] font-semibold`}>
						{day.title || <span className={cn(skeleton, "inline-block h-5 w-48 align-middle")} />}
					</h2>
				</div>
				{writing ? (
					<span className="animate-soft-pulse rounded-full bg-[#F4F3EF] px-2.5 py-1 text-[13px] font-semibold text-[#16181D]">
						Writing…
					</span>
				) : (
					<span className="flex items-center gap-1.5 rounded-full bg-[#DDEEE9] px-2.5 py-1 text-[13px] font-semibold text-[#0F5E52]">
						<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#0F5E52" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						Ready
					</span>
				)}
			</div>
			<div className="flex flex-col gap-3">
				{items.map((it, i) => {
					const last = writing && i === items.length - 1;
					return (
						<div key={i} className="flex gap-4">
							<span className={slotLabel}>{it.time ?? ""}</span>
							<span>
								{it.title}
								{it.title && it.description ? ". " : ""}
								<span className="text-[#4A4D55]">{it.description}</span>
								{last && (
									<span className="animate-caret-blink ml-0.5 inline-block h-[1.1em] w-0.5 bg-[#0F6B5C] align-text-bottom" />
								)}
							</span>
						</div>
					);
				})}
				{writing && (
					<div className="flex items-center gap-4">
						<span className={slotLabel} />
						<span className={cn(skeleton, "h-3 max-w-[60%] flex-1")} />
					</div>
				)}
			</div>
		</article>
	);
}

function Step({ label, state }: { label: string; state: "done" | "active" | "todo" }) {
	return (
		<li className="flex items-center gap-3">
			<span
				className={cn(
					"size-3 flex-none rounded-full",
					state === "done" && "bg-[#0F6B5C]",
					state === "active" && "border-[3px] border-[#0F6B5C] bg-white",
					state === "todo" && "bg-[#E2E0D8]",
				)}
			/>
			<span
				className={cn(
					"text-[15px]",
					state === "todo" ? "text-[#6B6E76]" : "text-[#16181D]",
					state === "active" && "font-semibold",
				)}
			>
				{label}
			</span>
		</li>
	);
}

function tripSummary(trip: TripInput) {
	return [dateRangeLabel(trip), trip.travellers, formatMoney(trip.budget, trip.currency), ...(trip.interests.length ? [trip.interests.join(", ")] : [])].join(" · ");
}
