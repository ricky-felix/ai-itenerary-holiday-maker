import Link from "next/link";
import { ItineraryView } from "@/components/itinerary-view";
import { SiteHeader } from "@/components/site-header";

export default function ItineraryPage() {
	return (
		<div className="min-h-screen bg-[#F4F3EF] font-[family-name:var(--font-inter)] text-base leading-normal text-[#16181D]">
			<SiteHeader>
				<Link
					href="/"
					className="flex min-h-11 items-center rounded-xl border border-[#CFCCC2] bg-white px-[18px] text-[15px] font-medium text-[#16181D] no-underline"
				>
					Plan another trip
				</Link>
			</SiteHeader>
			<ItineraryView />
		</div>
	);
}
