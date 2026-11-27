"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
	MAX_CHAT_HISTORY,
	MAX_CHAT_MESSAGE,
	type ChatTurn,
	type ExchangeRate,
	type Itinerary,
	type RefineEvent,
	type TripInput,
} from "@/lib/itinerary-schema";
import { readNdjson } from "@/lib/ndjson";

const ACCENT = "#0F6B5C";
const heading = "font-[family-name:var(--font-space-grotesk)]";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6B5C]";

const SUGGESTIONS = [
	"Make day 2 more relaxed",
	"Add a rainy-day backup",
	"Suggest cheaper places to eat",
	"What should I pack?",
];

type Message = ChatTurn & { updated?: boolean };

export function ItineraryChat({
	trip,
	itinerary,
	exchange,
	onUpdate,
}: {
	trip: TripInput;
	itinerary: Itinerary;
	exchange: ExchangeRate | null;
	onUpdate: (itinerary: Itinerary) => void;
}) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [pending, setPending] = useState(false);
	const [streamingReply, setStreamingReply] = useState("");
	const [updating, setUpdating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const listRef = useRef<HTMLDivElement>(null);

	// Cancel an in-flight request if the user leaves the page.
	useEffect(() => () => abortRef.current?.abort(), []);

	// Keep the newest message in view.
	useEffect(() => {
		listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
	}, [messages, streamingReply, updating]);

	async function send(text: string) {
		const message = text.trim();
		if (!message || pending) return;

		const history = messages.slice(-MAX_CHAT_HISTORY).map(({ role, content }) => ({ role, content }));
		setMessages((m) => [...m, { role: "user", content: message }]);
		setInput("");
		setError(null);
		setPending(true);
		setStreamingReply("");
		setUpdating(false);

		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const res = await fetch("/api/itinerary/refine", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ trip, itinerary, history, message, exchange }),
				signal: controller.signal,
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				setError(body?.error ?? "Couldn't send your message. Please try again.");
				return;
			}

			let finished = false;
			await readNdjson<RefineEvent>(res, (event) => {
				if (event.type === "reply") {
					setStreamingReply(event.text);
				} else if (event.type === "updating") {
					setUpdating(true);
				} else if (event.type === "done") {
					finished = true;
					setMessages((m) => [...m, { role: "assistant", content: event.reply, updated: !!event.itinerary }]);
					if (event.itinerary) onUpdate(event.itinerary);
				} else {
					finished = true;
					setError(event.message);
				}
			});
			if (!finished) setError("The connection dropped. Please try again.");
		} catch {
			if (!controller.signal.aborted) setError("Couldn't reach the server. Check your connection and try again.");
		} finally {
			if (!controller.signal.aborted) {
				setPending(false);
				setStreamingReply("");
				setUpdating(false);
			}
		}
	}

	return (
		<section className="flex flex-col gap-4 rounded-[20px] border border-[#E2E0D8] bg-white p-6">
			<div>
				<h2 className={`${heading} m-0 text-lg font-semibold`}>Ask or change something</h2>
				<p className="mt-1 text-[15px] text-[#4A4D55]">
					Ask a question, suggest an idea, or tell us what to change. Changes update the plan above.
				</p>
			</div>

			{(messages.length > 0 || pending) && (
				<div ref={listRef} aria-live="polite" className="flex max-h-[360px] flex-col gap-3 overflow-y-auto pr-1">
					{messages.map((m, i) =>
						m.role === "user" ? (
							<p key={i} className="m-0 max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#16181D] px-4 py-2.5 text-[15px] text-white">
								{m.content}
							</p>
						) : (
							<div key={i} className="flex max-w-[85%] flex-col gap-1.5 self-start">
								{m.updated && <UpdatedBadge />}
								<p className="m-0 rounded-2xl rounded-bl-md bg-[#F4F3EF] px-4 py-2.5 text-[15px] whitespace-pre-line text-[#16181D]">
									{m.content}
								</p>
							</div>
						),
					)}
					{pending && (
						<div className="flex max-w-[85%] flex-col gap-1.5 self-start">
							<p className="m-0 rounded-2xl rounded-bl-md bg-[#F4F3EF] px-4 py-2.5 text-[15px] whitespace-pre-line text-[#16181D]">
								{streamingReply || <span className="animate-soft-pulse text-[#5B5E66]">Thinking…</span>}
								{streamingReply && (
									<span className="animate-caret-blink ml-0.5 inline-block h-[1.1em] w-0.5 bg-[#0F6B5C] align-text-bottom" />
								)}
							</p>
							{updating && (
								<span className="animate-soft-pulse flex items-center gap-2 text-[13px] font-semibold text-[#0F5E52]">
									<span className="size-2 rounded-full bg-[#0F6B5C]" />
									Updating your itinerary…
								</span>
							)}
						</div>
					)}
				</div>
			)}

			{messages.length === 0 && !pending && (
				<div className="flex flex-wrap gap-2">
					{SUGGESTIONS.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => send(s)}
							className={cn(
								"min-h-11 cursor-pointer rounded-full border border-[#CFCCC2] bg-white px-4 text-[15px] font-medium text-[#16181D] hover:border-[#16181D]",
								focus,
							)}
						>
							{s}
						</button>
					))}
				</div>
			)}

			{error && (
				<p role="alert" className="m-0 rounded-xl bg-[#FDECEA] px-4 py-3 text-sm font-medium text-[#9F1D14]">
					{error}
				</p>
			)}

			<form
				onSubmit={(e) => {
					e.preventDefault();
					send(input);
				}}
				className="flex gap-2"
			>
				<label htmlFor="chat-input" className="sr-only">
					Your question or change
				</label>
				<input
					id="chat-input"
					type="text"
					value={input}
					maxLength={MAX_CHAT_MESSAGE}
					onChange={(e) => setInput(e.target.value)}
					placeholder="e.g. Swap the museum on day 1 for something outdoors"
					disabled={pending}
					className={cn(
						"h-12 min-w-0 flex-1 rounded-xl border border-[#CFCCC2] bg-white px-3.5 text-base text-[#16181D] disabled:bg-[#F4F3EF]",
						focus,
					)}
				/>
				<button
					type="submit"
					disabled={pending || !input.trim()}
					style={{ background: ACCENT }}
					className={cn(
						"flex h-12 flex-none cursor-pointer items-center gap-2 rounded-xl px-5 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50",
						focus,
					)}
				>
					<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					Send
				</button>
			</form>
		</section>
	);
}

function UpdatedBadge() {
	return (
		<span className="flex items-center gap-1.5 self-start rounded-full bg-[#DDEEE9] px-2.5 py-1 text-[13px] font-semibold text-[#0F5E52]">
			<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
				<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#0F5E52" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
			Itinerary updated
		</span>
	);
}
