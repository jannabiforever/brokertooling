// Figures ride along a manuscript as `[그림: ...]` lines: the transcript leaves a
// note where the photo had a figure, the figure agent draws SVG for each note,
// and the hwpx builder swaps the note's paragraph for the picture.

const NOTE = /^\[그림(?: \d+)?: .*\]$/

/** The `[그림: ...]` lines of a manuscript, trimmed, in order, without duplicates. */
export const notes = (manuscript: string): Array<string> =>
  Array.from(
    new Set(
      manuscript
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => NOTE.test(line)),
    ),
  )

/**
 * The SVG markup in a model response, or `undefined` when it is not a plain
 * static SVG. Anything that could run or load something is rejected outright
 * rather than sanitized: the preview is shown in a browser, and a redraw is
 * cheap.
 */
export const svgFromResponse = (response: string): string | undefined => {
  const svg = response.replace(/^```[^\n]*\n|\n```\s*$/g, "").trim()
  if (!svg.startsWith("<svg") || !svg.endsWith("</svg>")) return undefined
  if (/<script|<foreignObject|\bon[a-z]+\s*=|javascript:|href\s*=|url\s*\(/i.test(svg)) {
    return undefined
  }
  return svg
}
