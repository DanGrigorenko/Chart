import { createChart, type Slot } from "./chart";

/** Days 10.06–14.06.2026 as UTC timestamps. */
const days = [
  Date.UTC(2026, 5, 10),
  Date.UTC(2026, 5, 11),
  Date.UTC(2026, 5, 12),
  Date.UTC(2026, 5, 13),
  Date.UTC(2026, 5, 14),
];

const pair = (values: number[]): [number, number][] =>
  values.map((v, i) => [days[i], v]);

const area: Slot = { name: "Cost", data: pair([2.04, 25.85, 44.36, 55.65, 63.75]) };
const spline: Slot = { name: "ROI confirmed", data: pair([610.78, 180.5, 161.47, 56.33, 357.25]) };
const line: Slot = { name: "Conversions", decimals: 0, data: pair([3, 30, 36, 70, 90]) };
const bar: Slot = { name: "CPA", data: pair([0.68, 0.86, 1.23, 0.79, 0.71]) };

const container = document.getElementById("chart");
if (container) {
  createChart(container, { area, spline, line, bar });
}
