"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MAX_MUST_SEE, type PlaceSuggestion, type TripInput } from "@/lib/itinerary-schema";
import { saveTrip, useStoredTrip } from "@/lib/trip-session";

const ACCENT = "#0F6B5C";
const heading = "font-[family-name:var(--font-space-grotesk)]";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6B5C]";
const skeleton = "rounded-md bg-[#ECEAE4]";

export function PlacesView() {
	const router = useRouter();
	const trip = useStoredTrip();

	// No trip in this tab (e.g. page opened directly): go back to the form.
	useEffect(() => {
		if (trip === null) router.replace("/");
	}, [trip, router]);

	if (!trip) return null;
	return <PlacesPicker trip={trip} />;
}

function PlacesPicker({ trip }: { trip: TripInput }) {
	const router = useRouter();
	const [suggestions, setSuggestions] = useState<PlaceSuggestion[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	// Coming back to this page keeps earlier picks.
	const [selected, setSelected] = useState<string[]>(trip.mustSee ?? []);
	const [custom, setCustom] = useState("");

	// Only refetch when the trip itself changes, not when picks are saved.
	const tripKey = JSON.stringify({ ...trip, mustSee: [] });

	useEffect(() => {
		const controller = new AbortController();
		(async () => {
			try {
				const res = await fetch("/api/places", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: tripKey,
					signal: controller.signal,
				});
				const body = await res.json().catch(() => null);
				// A cancelled request (React runs effects twice in dev) isn't an error.
				if (controller.signal.aborted) return;
				if (!res.ok || !body?.places) {
					setLoadError(body?.error ?? "Couldn't load suggestions.");
					return;
				}
				setLoadError(null);
				setSuggestions(body.places);
			} catch {
				if (!controller.signal.aborted) setLoadError("Couldn't reach the server.");
			}
		})();
		return () => controller.abort();
	}, [tripKey]);

	const toggle = (name: string) =>
		setSelected((s) => (s.includes(name) ? s.filter((p) => p !== name) : [...s, name]));

	// "Bondi Beach, Thai food" adds two places.
	const addCustom = () => {
		const names = custom
			.split(",")
			.map((n) => n.trim())
			.filter(Boolean);
		if (names.length === 0) return;
		setSelected((s) => {
			const next = [...s];
			for (const name of names) {
				if (next.length >= MAX_MUST_SEE) break;
				if (!next.some((p) => p.toLowerCase() === name.toLowerCase())) next.push(name);
			}
			return next;
		});
		setCustom("");
	};

	const suggestedNames = new Set(suggestions?.map((p) => p.name));
	const customPicks = selected.filter((p) => !suggestedNames.has(p));

	const continueTo = (mustSee: string[]) => {
		saveTrip({ ...trip, mustSee });
		router.push("/generating");
	};

	return (
		<main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 pt-10 pb-20">
			<section className="flex flex-col gap-2">
				<span className="self-start rounded-full bg-[#DDEEE9] px-3 py-1.5 text-[13px] font-semibold tracking-[0.06em] text-[#0F5E52] uppercase">
					Before we plan
				</span>
				<h1 className={`${heading} m-0 text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-bold tracking-[-0.02em]`}>
					Any places you don&apos;t want to miss?
				</h1>
				<p className="m-0 max-w-[40rem] text-lg text-[#4A4D55]">
					Here are some ideas for {trip.destination}. Pick any you want in your plan, add your own, or skip
					and we&apos;ll choose for you.
				</p>
			</section>

			<section className="flex flex-col gap-6 rounded-[20px] border border-[#E2E0D8] bg-white p-6 sm:p-8">
				{/* Suggestions */}
				<fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
					<legend className="mb-3 p-0 text-sm font-semibold">
						Suggested for you <span className="font-normal text-[#5B5E66]">· pick any</span>
					</legend>
					{!suggestions && !loadError && (
						<div aria-live="polite" className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
							<span className="sr-only">Finding places…</span>
							{Array.from({ length: 6 }, (_, i) => (
								<div key={i} aria-hidden="true" className="flex flex-col gap-2 rounded-2xl border border-[#E2E0D8] p-4">
									<div className={cn(skeleton, "animate-soft-pulse h-4 w-1/2")} />
									<div className={cn(skeleton, "animate-soft-pulse h-3 w-[85%]")} />
								</div>
							))}
						</div>
					)}
					{loadError && !suggestions && (
						<p className="m-0 rounded-xl bg-[#F4F3EF] px-4 py-3 text-[15px] text-[#4A4D55]">
							{loadError} You can still add your own places below, or skip.
						</p>
					)}
					{suggestions && (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
							{suggestions.map((place) => {
								const on = selected.includes(place.name);
								return (
									<button
										key={place.name}
										type="button"
										aria-pressed={on}
										onClick={() => toggle(place.name)}
										className={cn(
											"flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left",
											on ? "border-[#0F6B5C] bg-[#F0F7F5]" : "border-[#E2E0D8] bg-white hover:border-[#CFCCC2]",
											focus,
										)}
									>
										<span
											aria-hidden="true"
											className={cn(
												"mt-0.5 flex size-5 flex-none items-center justify-center rounded-md border",
												on ? "border-[#0F6B5C] bg-[#0F6B5C]" : "border-[#CFCCC2] bg-white",
											)}
										>
											{on && (
												<svg width="12" height="12" viewBox="0 0 24 24">
													<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
												</svg>
											)}
										</span>
										<span className="flex flex-col gap-0.5">
											<span className="font-semibold">{place.name}</span>
											<span className="text-sm text-[#4A4D55]">{place.why}</span>
										</span>
									</button>
								);
							})}
						</div>
					)}
				</fieldset>

				{/* Own places */}
				<div className="flex flex-col gap-2">
					<label htmlFor="custom-place" className="text-sm font-semibold">
						Somewhere else in mind?
					</label>
					<div className="flex gap-2">
						<input
							id="custom-place"
							type="text"
							value={custom}
							maxLength={120}
							onChange={(e) => setCustom(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									addCustom();
								}
							}}
							placeholder="e.g. Bondi Beach, a Thai restaurant (separate with commas)"
							className={cn("h-12 min-w-0 flex-1 rounded-xl border border-[#CFCCC2] bg-white px-3.5 text-base", focus)}
						/>
						<button
							type="button"
							onClick={addCustom}
							disabled={!custom.trim() || selected.length >= MAX_MUST_SEE}
							className={cn(
								"h-12 flex-none cursor-pointer rounded-xl border border-[#CFCCC2] bg-white px-5 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50",
								focus,
							)}
						>
							Add
						</button>
					</div>
					{customPicks.length > 0 && (
						<ul className="m-0 flex list-none flex-wrap gap-2 p-0">
							{customPicks.map((name) => (
								<li key={name} className="flex items-center gap-1 rounded-full bg-[#0F6B5C] py-1 pr-1 pl-3.5 text-[15px] font-medium text-white">
									{name}
									<button
										type="button"
										onClick={() => toggle(name)}
										aria-label={`Remove ${name}`}
										className={cn("flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-white/15", focus)}
									>
										<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
											<path d="M6 6l12 12M18 6L6 18" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
										</svg>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>

				{/* Actions */}
				<div className="flex flex-wrap items-center gap-3 border-t border-[#E2E0D8] pt-6">
					<button
						type="button"
						onClick={() => continueTo(selected)}
						style={{ background: ACCENT }}
						className={cn(
							"flex h-14 cursor-pointer items-center justify-center gap-2.5 rounded-[14px] px-6 text-[17px] font-semibold text-white",
							focus,
						)}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" />
						</svg>
						{selected.length ? `Plan with ${selected.length} place${selected.length === 1 ? "" : "s"}` : "Generate itinerary"}
					</button>
					<button
						type="button"
						onClick={() => continueTo([])}
						className={cn("h-14 cursor-pointer rounded-[14px] px-4 text-[15px] font-semibold text-[#4A4D55] hover:text-[#16181D]", focus)}
					>
						Skip, you choose
					</button>
				</div>
			</section>
		</main>
	);
}
