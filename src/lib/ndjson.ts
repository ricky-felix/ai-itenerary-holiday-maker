/** Reads a newline-delimited JSON response, calling `onEvent` for each line. */
export async function readNdjson<E>(res: Response, onEvent: (event: E) => void) {
	if (!res.body) return;
	const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = "";
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += value;
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? ""; // keep any incomplete line for next time
		for (const line of lines) {
			if (line.trim()) onEvent(JSON.parse(line) as E);
		}
	}
}
