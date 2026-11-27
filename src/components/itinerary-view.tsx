"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { budgetBreakdown, dateRangeLabel, dayLabel, formatMoney, hasRoute, routeLabel } from "@/lib/itinerary-schema";
import { defaultTripName, MAX_TRIP_NAME, saveToDevice, useSavedTrips } from "@/lib/saved-trips";
import {
	saveItinerary,
	setSavedId,
	useStoredItinerary,
	useStoredExchange,
	useStoredSavedId,
	useStoredTrip,
} from "@/lib/trip-session";
import { BudgetEditor } from "./budget-editor";
import { ExchangeBanner } from "./exchange-banner";
import { ItineraryChat } from "./itinerary-chat";

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
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState<string | null>(null);
	const [editingBudget, setEditingBudget] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [naming, setNaming] = useState(false);
	const [nameDraft, setNameDraft] = useState("");
	const savedId = useStoredSavedId();
	const savedTrips = useSavedTrips();
	const exchange = useStoredExchange();

	// Nothing generated in this tab yet: start from the form.
	useEffect(() => {
		if (trip === null || itinerary === null) router.replace("/");
	}, [trip, itinerary, router]);

	if (!trip || !itinerary || itinerary.days.length === 0) return null;

	const money = (n: number) => formatMoney(n, trip.currency);
	const dayIndex = Math.min(selected, itinerary.days.length - 1);
	const day = itinerary.days[dayIndex];
	const dayCost = day.items.reduce((sum, it) => sum + it.cost, 0);

	const budget = budgetBreakdown(itinerary, trip);
	const multiStop = trip.stops.length > 0;
	const total = budget.total;
	const overBudget = total > trip.budget;
	const usedPct = Math.min(100, Math.round((total / trip.budget) * 100));
	const n = itinerary.days.length;

	// Builds the PDF in the browser and downloads it. The PDF library is large, so
	// it's only loaded when someone actually clicks Export.
	// Saved on this device? "Saved" only if the saved copy matches what's on screen
	// (chat changes after saving make it "Save changes").
	const savedEntry = savedTrips?.find((e) => e.id === savedId);
	const isSaved =
		!!savedEntry &&
		JSON.stringify(savedEntry.itinerary) === JSON.stringify(itinerary) &&
		JSON.stringify(savedEntry.trip) === JSON.stringify(trip);

	// Saving asks for a name first (pre-filled), which is also the PDF file name.
	function openNaming() {
		if (!itinerary) return;
		setNameDraft(savedEntry?.name ?? defaultTripName(itinerary));
		setNaming(true);
	}

	function saveLocally(e: React.FormEvent) {
		e.preventDefault();
		if (!trip || !itinerary) return;
		try {
			setSavedId(
				saveToDevice(trip, itinerary, { id: savedEntry?.id, name: nameDraft, exchange: exchange ?? null }),
			);
			setSaveError(null);
			setNaming(false);
		} catch {
			setSaveError("Couldn't save on this device. Storage may be full or blocked (e.g. private browsing).");
		}
	}

	async function exportPdf() {
		if (!trip || !itinerary) return;
		setExporting(true);
		setExportError(null);
		try {
			const [{ pdf }, { ItineraryPdf }] = await Promise.all([
				import("@react-pdf/renderer"),
				import("./itinerary-pdf"),
			]);
			const blob = await pdf(<ItineraryPdf trip={trip} itinerary={itinerary} exchange={exchange ?? null} />).toBlob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			// Use the saved name when there is one, e.g. "honeymoon-japan.pdf".
			link.download = `${slug(savedEntry?.name ?? `${itinerary.destinationName} itinerary`)}.pdf`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
		} catch (error) {
			console.error("[pdf]", error);
			setExportError("Couldn't create the PDF. Please try again.");
		} finally {
			setExporting(false);
		}
	}

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
						{hasRoute(trip) && <span className="font-semibold text-[#16181D]">{routeLabel(trip)}</span>}
						<span>{dateRangeLabel(trip)}</span>
						<span>{trip.travellers}</span>
						<span>{trip.pace} pace</span>
						{savedEntry && <span>Saved as &ldquo;{savedEntry.name}&rdquo;</span>}
					</div>
				</div>
				<div className="flex flex-wrap gap-2.5">
					<button
						type="button"
						onClick={openNaming}
						aria-expanded={naming}
						title={isSaved ? "Rename this trip" : undefined}
						className={cn(
							"flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-5 text-[15px] font-semibold",
							isSaved ? "border-[#DDEEE9] bg-[#DDEEE9] text-[#0F5E52]" : "border-[#CFCCC2] bg-white text-[#16181D]",
							focus,
						)}
					>
						{isSaved ? (
							<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
								<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#0F5E52" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						) : (
							<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
								<path d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4V5a1 1 0 0 1 1-1z" fill="none" stroke="#16181D" strokeWidth="1.9" strokeLinejoin="round" />
							</svg>
						)}
						{isSaved ? "Saved" : savedEntry ? "Save changes" : "Save trip"}
					</button>
					<button
						type="button"
						onClick={exportPdf}
						disabled={exporting}
						aria-busy={exporting}
						className={cn(
							"flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-[#CFCCC2] bg-white px-5 text-[15px] font-semibold text-[#16181D] disabled:cursor-wait disabled:opacity-60",
							focus,
						)}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="#16181D" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						{exporting ? "Preparing PDF…" : "Export PDF"}
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
			{naming && (
				<form
					onSubmit={saveLocally}
					onKeyDown={(e) => {
						if (e.key === "Escape") setNaming(false);
					}}
					className="flex flex-wrap items-end gap-3 rounded-[20px] border-2 border-[#0F6B5C] bg-white p-5"
				>
					<div className="flex min-w-[240px] flex-1 flex-col gap-2">
						<label htmlFor="trip-name" className="text-sm font-semibold">
							Name this trip <span className="font-normal text-[#5B5E66]">· also used as the PDF file name</span>
						</label>
						<input
							id="trip-name"
							type="text"
							autoFocus
							value={nameDraft}
							maxLength={MAX_TRIP_NAME}
							onChange={(e) => setNameDraft(e.target.value)}
							onFocus={(e) => e.target.select()}
							className={cn("h-12 rounded-xl border border-[#CFCCC2] px-3.5 text-base", focus)}
						/>
					</div>
					<button
						type="submit"
						style={{ background: ACCENT }}
						className={cn("min-h-12 cursor-pointer rounded-xl px-6 text-[15px] font-semibold text-white", focus)}
					>
						{savedEntry ? "Save" : "Save trip"}
					</button>
					<button
						type="button"
						onClick={() => setNaming(false)}
						className={cn("min-h-12 cursor-pointer rounded-xl px-4 text-[15px] font-semibold text-[#4A4D55] hover:text-[#16181D]", focus)}
					>
						Cancel
					</button>
				</form>
			)}

			{(exportError || saveError) && (
				<p role="alert" className="m-0 rounded-[14px] bg-[#FDECEA] px-5 py-3 font-medium text-[#9F1D14]">
					{saveError ?? exportError}
				</p>
			)}

			{shareNotice && (
				<div role="status" className="flex flex-wrap items-center gap-3 rounded-[14px] bg-[#16181D] py-3 pr-3 pl-5 text-white">
					<span className="font-semibold">Share links are coming soon</span>
					<span className="flex-1 text-sm text-[#C9CBD1]">For now, use Save trip to keep it on this device, or Export PDF to send it.</span>
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

			{/* Questions, suggestions and changes. Updates replace the stored itinerary. */}
			<ItineraryChat trip={trip} itinerary={itinerary} exchange={exchange ?? null} onUpdate={saveItinerary} />

			{editingBudget && (
				<BudgetEditor trip={trip} itinerary={itinerary} onClose={() => setEditingBudget(false)} />
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
									{multiStop && itinerary.days[i].location && (
										<span className="block max-w-[140px] truncate text-xs opacity-80">{itinerary.days[i].location}</span>
									)}
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
									{multiStop && day.location ? ` · ${day.location}` : ""}
								</div>
								<h2 className={`${heading} mt-1 text-[28px] font-semibold tracking-[-0.01em]`}>{day.title}</h2>
								<p className="mt-1.5 max-w-[36rem] text-[#4A4D55]">{day.summary}</p>
							</div>
							<div className="flex-none text-right">
								<div className="text-[13px] text-[#5B5E66]">Est. for the day · everyone</div>
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
						<div className="flex items-center justify-between gap-3">
							<h2 className={`${heading} m-0 text-lg font-semibold`}>Budget</h2>
							<button
								type="button"
								onClick={() => {
									setEditingBudget(true);
									// The editor opens above the days; bring it into view.
									requestAnimationFrame(() =>
										document.getElementById("edit-budget")?.scrollIntoView({ behavior: "smooth", block: "center" }),
									);
								}}
								disabled={editingBudget}
								className={cn(
									"flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-[15px] font-semibold text-[#0F5E52] hover:bg-[#F0F7F5] disabled:cursor-default disabled:opacity-50",
									focus,
								)}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="#0F5E52" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
								Edit
							</button>
						</div>
						{/* Wraps so long amounts (e.g. rupiah) never spill out of the card. */}
						<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
							<span className={`${heading} min-w-0 text-[34px] leading-tight font-bold break-words`}>{money(total)}</span>
							<span className={overBudget ? "font-semibold text-[#9F1D14]" : "text-[#4A4D55]"}>
								of <span className="whitespace-nowrap">{money(trip.budget)}</span> for everyone
								{overBudget ? " (over budget)" : ""}
							</span>
						</div>
						{/* Budget in the local currency, when it differs from the trip currency. */}
						<ExchangeBanner trip={trip} localCurrency={itinerary.localCurrency} />
						<div
							role="img"
							aria-label={`${money(total)} of ${money(trip.budget)} budget used`}
							className="h-2.5 overflow-hidden rounded-full bg-[#E2E0D8]"
						>
							<div className="h-full" style={{ width: `${usedPct}%`, background: overBudget ? "#9F1D14" : ACCENT }} />
						</div>
						<dl className="m-0 flex flex-col gap-2.5 text-[15px]">
							{budget.lines.map((line) => (
								<div key={line.label} className="flex justify-between gap-3">
									<dt className="text-[#4A4D55]">
										{line.label}
										{line.note && <span className="ml-1.5 text-[13px] text-[#5B5E66]">· {line.note}</span>}
									</dt>
									<dd className={cn("m-0", line.amount === null ? "text-[#5B5E66]" : "font-semibold")}>
										{line.amount === null ? "—" : money(line.amount)}
									</dd>
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

/** "São Paulo" → "sao-paulo", for file names. */
function slug(text: string) {
	return (
		text
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "trip"
	);
}
