import Link from "next/link";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
	return (
		<header className="border-b border-[#E2E0D8] bg-white">
			<div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4">
				<Link href="/" className="flex items-center gap-2.5 text-[#16181D] no-underline">
					<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
						<rect width="32" height="32" rx="8" fill="#0F6B5C" />
						<path
							d="M9 21l5-11 4 7 2-3 3 7"
							fill="none"
							stroke="#FFFFFF"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					<span className="font-[family-name:var(--font-space-grotesk)] text-lg font-bold">
						Holiday Maker
					</span>
				</Link>
				{children}
			</div>
		</header>
	);
}
