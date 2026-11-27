"use client";

import { cn } from "@/lib/utils";
import type { TripInput } from "@/lib/itinerary-schema";

// Shared by the trip form and the budget editor on the itinerary page.

const label = "text-sm font-semibold";
const focus = "focus:outline-2 focus:outline-offset-1 focus:outline-[#0F6B5C]";

export type CostMode = "estimate" | "manual" | "excluded";

/** Empty input (NaN) or 0 means "nothing entered". */
export const isBlank = (amount: number) => Number.isNaN(amount) || amount === 0;

const COST_MODES: [CostMode, string][] = [
	["estimate", "Estimate"],
	["manual", "I'll enter it"],
	["excluded", "Not in budget"],
];

/** "Estimate / I'll enter it / Not in budget" control, used for hotel and tickets. */
export function CostChoice({
	id,
	label: text,
	sublabel,
	mode,
	onModeChange,
	currency,
	amount,
	onAmountChange,
	placeholder,
	per,
	hint,
	children,
}: {
	id: string;
	label: string;
	sublabel?: string;
	mode: CostMode;
	onModeChange: (mode: CostMode) => void;
	currency: TripInput["currency"];
	amount: number;
	onAmountChange: (amount: number) => void;
	placeholder: string;
	per?: React.ReactNode;
	hint: Record<CostMode, string>;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2">
			<span id={`${id}-label`} className={label}>
				{text} {sublabel && <span className="font-normal text-[#5B5E66]">· {sublabel}</span>}
			</span>
			<div role="group" aria-labelledby={`${id}-label`} className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#F4F3EF] p-1">
				{COST_MODES.map(([value, name]) => {
					const on = mode === value;
					return (
						<button
							key={value}
							type="button"
							aria-pressed={on}
							onClick={() => onModeChange(value)}
							className={cn(
								"h-11 cursor-pointer rounded-[9px] border-0 px-1 text-[15px] font-semibold",
								on ? "bg-white text-[#16181D] shadow-[0_1px_3px_rgba(22,24,29,0.12)]" : "bg-transparent text-[#5B5E66]",
								focus,
							)}
						>
							{name}
						</button>
					);
				})}
			</div>
			{mode === "manual" && (
				<div className="flex h-12 overflow-hidden rounded-xl border border-[#CFCCC2]">
					<span className="flex items-center border-r border-[#E2E0D8] bg-[#F4F3EF] px-3 text-[15px] text-[#4A4D55]">
						{currency}
					</span>
					<label htmlFor={`${id}-amount`} className="sr-only">
						{text} in {currency}
					</label>
					<input
						id={`${id}-amount`}
						type="number"
						min={1}
						inputMode="numeric"
						placeholder={placeholder}
						value={Number.isNaN(amount) ? "" : amount}
						onChange={(e) => onAmountChange(e.target.valueAsNumber)}
						className={cn("min-w-0 flex-1 border-0 px-3.5 text-base text-[#16181D]", focus)}
					/>
					{per}
				</div>
			)}
			{children}
			<p className="m-0 text-sm text-[#5B5E66]">{hint[mode]}</p>
		</div>
	);
}
