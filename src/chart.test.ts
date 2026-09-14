import { describe, it, expect } from "vitest";
import { buildOptions } from "./chart";

const input = {
  area: { name: "Cost", data: [[0, 1] as [number, number]] },
  spline: { name: "ROI confirmed", data: [[0, 2] as [number, number]] },
  line: { name: "Conversions", decimals: 0, data: [[0, 3] as [number, number]] },
  bar: { name: "CPA", data: [[0, 4] as [number, number]] },
};

describe("buildOptions", () => {
  it("produces exactly 4 series with the expected display types", () => {
    const series = buildOptions(input).series ?? [];
    expect(series).toHaveLength(4);
    expect(series.map((s) => (s as { type: string }).type)).toEqual([
      "area",
      "spline",
      "line",
      "column",
    ]);
  });

  it("gives every series its own yAxis", () => {
    const series = buildOptions(input).series ?? [];
    const axisIndexes = series.map((s) => (s as { yAxis: number }).yAxis);
    expect(axisIndexes).toEqual([0, 1, 2, 3]);
    expect(new Set(axisIndexes).size).toBe(4);
  });

  it("hides all axes: no visible x or y axis chrome", () => {
    const options = buildOptions(input);
    const yAxes = (Array.isArray(options.yAxis) ? options.yAxis : [options.yAxis]).filter(Boolean);
    expect(yAxes).toHaveLength(4);
    for (const axis of yAxes) {
      expect(axis!.visible).toBe(false);
    }
    const xAxis = Array.isArray(options.xAxis) ? options.xAxis[0] : options.xAxis;
    expect(xAxis!.visible).toBe(false);
  });

  it("strips all chart chrome (legend, title, credits)", () => {
    const options = buildOptions(input);
    expect(options.legend?.enabled).toBe(false);
    expect(options.title?.text).toBe("");
    expect(options.credits?.enabled).toBe(false);
  });

  it("shared tooltip lists series in reference order: Cost, CPA, ROI confirmed, Conversions", () => {
    const options = buildOptions(input);
    const series = options.series ?? [];
    const formatter = options.tooltip!.formatter!;
    // Feed the points in rendering (series) order — area, spline, line, column —
    // which is NOT the reference tooltip order, so the formatter must reorder.
    const points = series.map((s) => {
      const so = s as { name: string; color: string; custom: unknown };
      return { series: { name: so.name, options: { custom: so.custom } }, color: so.color, y: 1 };
    });
    const html = (formatter as (this: unknown) => string).call({ x: 0, points });
    const order = ["Cost", "CPA", "ROI confirmed", "Conversions"].map((n) => html.indexOf(n));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("carries series names and defaults decimals to 2, honouring overrides", () => {
    const options = buildOptions(input);
    const tooltip = options.tooltip!;
    // decimals live on the series so the shared tooltip can format each row
    const decimals = (options.series ?? []).map((s) => (s as { custom: { decimals: number } }).custom.decimals);
    expect(decimals).toEqual([2, 2, 0, 2]);
    expect(tooltip.shared).toBe(true);
  });
});
