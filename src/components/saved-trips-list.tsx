"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { dateRangeLabel, routeLabel } from "@/lib/itinerary-schema";
import { deleteSaved, useSavedTrips, type SavedTrip } from "@/lib/saved-trips";
import { openSavedTrip } from "@/lib/trip-session";

const heading = "font-[family-name:var(--font-space-grotesk)]";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6B5C]";

/** Trips saved on this device, shown on the home page. Hidden when there are none. */
export function SavedTripsList() {
	const router = useRouter();
	const saved = useSavedTrips();
	if (!saved || saved.length === 0) return null;

	const open = (entry: SavedTrip) => {
		openSavedTrip(entry);
		router.push("/itinerary");
	};

	return (
		<section aria-labelledby="saved-heading" className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 pb-20">
			<div>
				<h2 id="saved-heading" className={`${heading} m-0 text-[22px] font-semibold`}>
					Your saved trips
				</h2>
				<p className="mt-1 text-[15px] text-[#5B5E66]">Saved on this device only.</p>
			</div>
			<ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-0">
				{saved.map((entry) => {
					const n = entry.itinerary.days.length;
					return (
						<li key={entry.id} className="flex flex-col gap-4 rounded-[18px] border border-[#E2E0D8] bg-white p-5">
							<div className="flex flex-col gap-1">
								<span className={`${heading} text-lg font-semibold break-words`}>{entry.name}</span>
								<span className="text-[15px] text-[#4A4D55]">
									{n} day{n === 1 ? "" : "s"} · {routeLabel(entry.trip)}
								</span>
								<span className="text-[15px] text-[#4A4D55]">
									{dateRangeLabel(entry.trip)} · {entry.trip.travellers}
								</span>
								<span className="text-[13px] text-[#5B5E66]">
									Saved {new Date(entry.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
								</span>
							</div>
							<div className="mt-auto flex items-center gap-2">
								<button
									type="button"
									onClick={() => open(entry)}
									className={cn(
										"flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl bg-[#0F6B5C] px-4 text-[15px] font-semibold text-white",
										focus,
									)}
								>
									Open
								</button>
								<button
									type="button"
									onClick={() => deleteSaved(entry.id)}
									aria-label={`Delete ${entry.name}`}
									className={cn(
										"min-h-11 cursor-pointer rounded-xl px-3 text-[15px] font-semibold text-[#9F1D14] hover:bg-[#FDECEA]",
										focus,
									)}
								>
									Delete
								</button>
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
