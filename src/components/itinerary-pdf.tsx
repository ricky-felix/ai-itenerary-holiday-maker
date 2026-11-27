import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
	budgetBreakdown,
	dateRangeLabel,
	formatAmount,
	formatDate,
	type ExchangeRate,
	dayLabel,
	formatMoney,
	routeLabel,
	type Itinerary,
	type TripInput,
} from "@/lib/itinerary-schema";

// The PDF version of the itinerary. Built with react-pdf primitives
// (Document/Page/View/Text), not HTML, and styled to match the app.
// Uses the built-in Helvetica font, which covers Latin scripts.

const C = {
	ink: "#16181D",
	muted: "#4A4D55",
	subtle: "#5B5E66",
	line: "#E2E0D8",
	ground: "#F4F3EF",
	accent: "#0F6B5C",
	accentSoft: "#DDEEE9",
	accentInk: "#0F5E52",
	danger: "#9F1D14",
};

const s = StyleSheet.create({
	page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: C.ink, lineHeight: 1.45 },
	brand: { flexDirection: "row", alignItems: "center", marginBottom: 22 },
	brandMark: { width: 16, height: 16, borderRadius: 4, backgroundColor: C.accent, marginRight: 7 },
	brandName: { fontFamily: "Helvetica-Bold", fontSize: 11 },
	title: { fontFamily: "Helvetica-Bold", fontSize: 26, lineHeight: 1.15, marginBottom: 6 },
	meta: { fontSize: 10.5, color: C.muted, marginBottom: 18 },
	summaryRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
	box: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12 },
	boxTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 6 },
	budgetTotal: { fontFamily: "Helvetica-Bold", fontSize: 16, marginBottom: 2 },
	budgetOf: { fontSize: 9.5, color: C.muted, marginBottom: 8 },
	budgetLine: { flexDirection: "row", justifyContent: "space-between", fontSize: 9.5, marginBottom: 2 },
	fx: { backgroundColor: C.ground, borderRadius: 6, padding: 8, marginBottom: 10 },
	fxLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: C.subtle, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 3 },
	fxMain: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 2 },
	fxSmall: { fontSize: 8.5, color: C.muted },
	tip: { fontSize: 9.5, color: C.muted, marginBottom: 4 },
	dayHeader: { backgroundColor: C.ground, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
	dayLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: C.subtle, letterSpacing: 0.6, textTransform: "uppercase" },
	dayTitle: { fontFamily: "Helvetica-Bold", fontSize: 14, marginTop: 2 },
	dayCost: { fontFamily: "Helvetica-Bold", fontSize: 11 },
	daySummary: { fontSize: 10, color: C.muted, marginBottom: 8, paddingHorizontal: 12 },
	item: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.line },
	itemTime: { width: 46, fontFamily: "Helvetica-Bold", fontSize: 9.5, color: C.muted },
	itemBody: { flex: 1, paddingRight: 10 },
	itemTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
	itemDesc: { fontSize: 9.5, color: C.muted, marginTop: 1 },
	itemTag: { fontSize: 8, color: C.accentInk, marginTop: 3 },
	itemCost: { width: 70, textAlign: "right", fontSize: 9.5, color: C.muted },
	day: { marginBottom: 18 },
	footer: { position: "absolute", bottom: 24, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.subtle },
});

// PDF fonts don't have every space character Intl uses; normalise to plain spaces.
const clean = (text: string) => text.replace(/[  ]/g, " ");

export function ItineraryPdf({
	trip,
	itinerary,
	exchange,
}: {
	trip: TripInput;
	itinerary: Itinerary;
	exchange: ExchangeRate | null;
}) {
	// Only show a rate that matches this trip's currency.
	const rate = exchange && exchange.from === trip.currency ? exchange : null;
	const money = (n: number) => clean(formatMoney(n, trip.currency));
	const n = itinerary.days.length;
	const budget = budgetBreakdown(itinerary, trip);
	const total = budget.total;
	const title = `${n} day${n === 1 ? "" : "s"} in ${itinerary.destinationName}`;

	return (
		<Document title={title} author="Holiday Maker" subject={`Itinerary for ${trip.destination}`}>
			<Page size="A4" style={s.page}>
				<View style={s.brand}>
					<View style={s.brandMark} />
					<Text style={s.brandName}>Holiday Maker</Text>
				</View>

				<Text style={s.title}>{title}</Text>
				<Text style={s.meta}>
					{[clean(dateRangeLabel(trip)), trip.travellers, `${trip.pace} pace`, routeLabel(trip).replace(/→/g, ">")].join("  ·  ")}
				</Text>

				{/* Budget + tips */}
				<View style={s.summaryRow} wrap={false}>
					<View style={s.box}>
						<Text style={s.boxTitle}>Budget</Text>
						<Text style={s.budgetTotal}>{money(total)}</Text>
						<Text style={[s.budgetOf, total > trip.budget ? { color: C.danger } : {}]}>
							of {money(trip.budget)} for everyone
							{total > trip.budget ? " (over budget)" : ""}
						</Text>
						{rate && (
							<View style={s.fx}>
								<Text style={s.fxLabel}>
									Exchange rate  ·  {rate.from} to {rate.to}
								</Text>
								<Text style={s.fxMain}>
									{money(trip.budget)} = approx. {clean(formatAmount(trip.budget * rate.rate, rate.to, "code"))}
								</Text>
								<Text style={s.fxSmall}>
									1 {rate.to} = {clean(formatAmount(1 / rate.rate, rate.from))}  ·  1 {rate.from} ={" "}
									{clean(formatAmount(rate.rate, rate.to, "code"))}
								</Text>
								<Text style={s.fxSmall}>
									Rate published {formatDate(rate.updatedAt)}
									{rate.checkedAt ? `, checked ${formatDate(rate.checkedAt, true)}` : ""}. Source: ExchangeRate-API.
								</Text>
							</View>
						)}
						{budget.lines.map((line) => (
							<View key={line.label} style={s.budgetLine}>
								<Text style={{ color: C.muted }}>
									{line.label}
									{line.note ? `  · ${line.note}` : ""}
								</Text>
								<Text style={{ fontFamily: line.amount === null ? "Helvetica" : "Helvetica-Bold", color: line.amount === null ? C.subtle : C.ink }}>
									{line.amount === null ? "-" : money(line.amount)}
								</Text>
							</View>
						))}
					</View>
					{itinerary.tips.length > 0 && (
						<View style={s.box}>
							<Text style={s.boxTitle}>Good to know</Text>
							{itinerary.tips.map((tip, i) => (
								<Text key={i} style={s.tip}>
									•  {tip}
								</Text>
							))}
						</View>
					)}
				</View>

				{/* Days */}
				{itinerary.days.map((day, i) => {
					const dayCost = day.items.reduce((sum, it) => sum + it.cost, 0);
					return (
						<View key={i} style={s.day}>
							{/* Keep the header with at least the first activity. */}
							<View wrap={false}>
								<View style={s.dayHeader}>
									<View style={{ flex: 1 }}>
										<Text style={s.dayLabel}>
											Day {i + 1}  ·  {dayLabel(trip.startDate, i)}
											{trip.stops.length && day.location ? `  ·  ${day.location}` : ""}
										</Text>
										<Text style={s.dayTitle}>{day.title}</Text>
									</View>
									<Text style={s.dayCost}>{money(dayCost)}</Text>
								</View>
								<Text style={s.daySummary}>{day.summary}</Text>
								{day.items[0] && <Item item={day.items[0]} money={money} />}
							</View>
							{day.items.slice(1).map((item, j) => (
								<Item key={j} item={item} money={money} />
							))}
						</View>
					);
				})}

				<View style={s.footer} fixed>
					<Text>Estimates generated by AI. Check prices and opening times before booking.</Text>
					<Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
				</View>
			</Page>
		</Document>
	);
}

function Item({ item, money }: { item: Itinerary["days"][number]["items"][number]; money: (n: number) => string }) {
	return (
		<View style={s.item} wrap={false}>
			<Text style={s.itemTime}>{item.time}</Text>
			<View style={s.itemBody}>
				<Text style={s.itemTitle}>{item.title}</Text>
				<Text style={s.itemDesc}>{item.description}</Text>
				<Text style={s.itemTag}>{item.tag}</Text>
			</View>
			<Text style={s.itemCost}>{money(item.cost)}</Text>
		</View>
	);
}
