import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment. Server-side only — never import in client components.
export const anthropic = new Anthropic();

export const ITINERARY_MODEL = "claude-opus-5-5";
