import { SavedTripsList } from "@/components/saved-trips-list";
import { SiteHeader } from "@/components/site-header";
import { TripForm } from "@/components/trip-form";

const STEPS = [
	{ title: "Describe the trip", body: "Destination, dates, budget and interests." },
	{ title: "Watch it come together", body: "Days appear as they're written. No blank wait." },
	{ title: "Take it with you", body: "Download a PDF or copy a share link." },
];

const heading = "font-[family-name:var(--font-space-grotesk)]";

export default function Home() {
	return (
		<div className="min-h-screen bg-[#F4F3EF] font-[family-name:var(--font-inter)] text-base leading-normal text-[#16181D]">
			<SiteHeader>
				<span className="text-sm text-[#5B5E66]">
					Day-by-day itineraries, planned by Claude
				</span>
			</SiteHeader>

			<main className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-12 px-6 pt-14 pb-20">
				<section className="flex min-w-0 flex-[1_1_380px] flex-col gap-6 pt-2">
					<span className="self-start rounded-full bg-[#DDEEE9] px-3 py-1.5 text-[13px] font-semibold tracking-[0.06em] text-[#0F5E52] uppercase">
						New trip
					</span>
					<h1
						className={`${heading} m-0 text-[clamp(2.5rem,5vw,3.75rem)] leading-[1.04] font-bold tracking-[-0.02em]`}
					>
						Tell us where.
						<br />
						We&apos;ll plan every day.
					</h1>
					<p className="m-0 max-w-[30rem] text-lg text-[#4A4D55]">
						Enter a destination, your dates, a budget and what you love.
						You&apos;ll get a day-by-day plan you can export as a PDF or share
						with a link.
					</p>
					<ol className="mt-2 flex list-none flex-col gap-4 p-0">
						{STEPS.map((step, i) => (
							<li key={step.title} className="flex items-start gap-3.5">
								<span className="flex size-7 flex-none items-center justify-center rounded-full bg-[#16181D] text-[13px] font-semibold text-white">
									{i + 1}
								</span>
								<span>
									<strong className="font-semibold">{step.title}</strong>
									<br />
									<span className="text-[15px] text-[#5B5E66]">{step.body}</span>
								</span>
							</li>
						))}
					</ol>
				</section>

				<TripForm />
			</main>

			<SavedTripsList />
		</div>
	);
}
