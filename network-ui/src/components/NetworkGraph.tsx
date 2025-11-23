import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { ElectionLink, ElectionNode } from "../types";

interface Props {
  nodes: ElectionNode[];
  links: ElectionLink[];
  selectedNodeId: number | null;
  onSelectNode: (id: number) => void;
  usePartyColors: boolean;
}

type SimNode = ElectionNode & { x?: number; y?: number; vx?: number; vy?: number; value: number };

export default function NetworkGraph({ nodes, links, selectedNodeId, onSelectNode, usePartyColors }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const graphData = useMemo(() => {
    const simNodes: SimNode[] = nodes.map((n) => ({
      ...n,
      value: Math.max((n.total_in ?? 0) + (n.total_out ?? 0), 1),
    }));
    const simLinks = links.map((l) => ({ ...l }));
    return { nodes: simNodes, links: simLinks };
  }, [nodes, links]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    svg.selectAll("*").remove();

    const radiusScale = d3
      .scaleSqrt()
      .domain([1, d3.max(graphData.nodes, (d) => d.value) || 1])
      .range([5, 40]);

    const amountScale = d3
      .scaleSqrt()
      .domain([1, d3.max(graphData.links, (d) => d.total_amount) || 1])
      .range([1, 6]);

    const colorByNode = (node: ElectionNode) => {
      if (usePartyColors) {
        const party = (node.party || "").toUpperCase();
        if (party === "R") return "#ef4444"; // red
        if (party === "D") return "#3b82f6"; // blue
        return "#9ca3af"; // gray for unknown/others
      }
      switch ((node.type || "").toLowerCase()) {
        case "candidate":
          return "#3b82f6";
        case "committee":
        case "pac":
          return "#f97316";
        case "company":
        case "corp":
          return "#10b981";
        case "person":
        default:
          return "#a855f7";
      }
    };

    const simulation = d3
      .forceSimulation(graphData.nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(graphData.links)
          .id((d: any) => d.id)
          .distance(120),
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d: any) => radiusScale((d as SimNode).value) + 6),
      );

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom as any);

    const link = g
      .append("g")
      .attr("stroke", "#475569")
      .selectAll("line")
      .data(graphData.links)
      .enter()
      .append("line")
      .attr("stroke-width", (d) => amountScale(Math.max(d.total_amount ?? 0, 1)));

    const node = g
      .append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .enter()
      .append("g")
      .style("cursor", "pointer")
      .on("click", (_, d) => onSelectNode(d.id));

    node
      .append("circle")
      .attr("r", (d) => radiusScale(d.value))
      .attr("fill", (d) => colorByNode(d))
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1);

    node
      .append("text")
      .text((d) => d.name)
      .attr("text-anchor", "middle")
      .attr("y", (d) => -radiusScale(d.value) - 4)
      .attr("fill", "#e2e8f0")
      .attr("font-size", "10px");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => (d.source as SimNode).x || 0)
        .attr("y1", (d: any) => (d.source as SimNode).y || 0)
        .attr("x2", (d: any) => (d.target as SimNode).x || 0)
        .attr("y2", (d: any) => (d.target as SimNode).y || 0);

      node.attr("transform", (d: any) => `translate(${d.x || 0},${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, onSelectNode]);

  useEffect(() => {
    if (!svgRef.current) return;
    const circles = d3.select(svgRef.current).selectAll("circle");
    circles
      .attr("stroke", (d: any) => (d.id === selectedNodeId ? "#06b6d4" : "#0f172a"))
      .attr("stroke-width", (d: any) => (d.id === selectedNodeId ? 3 : 1.5));
  }, [selectedNodeId]);

  return <svg ref={svgRef} className="w-full h-full bg-gray-950" />;
}
