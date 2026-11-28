import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
	variable: "--font-space-grotesk",
	subsets: ["latin"],
	weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
	title: "AI Itinerary Holiday Maker",
	description: "Day-by-day itineraries, planned by Claude",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	);
}
