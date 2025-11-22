import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { Relationship, GraphNode, GraphLink } from '../types';
import { fetchActorCount } from '../api';

interface NetworkGraphProps {
  relationships: Relationship[];
  selectedActor: string | null;
  onActorClick: (actorName: string) => void;
  minDensity: number;
  actorTotalCounts: Record<string, number>;
}

export default function NetworkGraph({
  relationships,
  selectedActor,
  onActorClick,
  minDensity,
  actorTotalCounts
}: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodeGroupRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null);
  const linkGroupRef = useRef<d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null);
  const [onDemandCounts, setOnDemandCounts] = useState<Record<string, number>>({});

  const graphData = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const EPSTEIN_NAME = 'Jeffrey Epstein';

    // First pass: build complete graph and deduplicate edges
    const edgeMap = new Map<string, GraphLink & { count: number }>();

    relationships.forEach((rel) => {
      // Add actor node
      if (!nodeMap.has(rel.actor)) {
        nodeMap.set(rel.actor, {
          id: rel.actor,
          name: rel.actor,
          val: 1,
          color: '#10b981' // Temporary, will be set later
        });
      } else {
        const node = nodeMap.get(rel.actor)!;
        node.val += 1;
      }

      // Add target node
      if (!nodeMap.has(rel.target)) {
        nodeMap.set(rel.target, {
          id: rel.target,
          name: rel.target,
          val: 1,
          color: '#ef4444' // Temporary, will be set later
        });
      } else {
        const node = nodeMap.get(rel.target)!;
        node.val += 1;
      }

      // Deduplicate edges: Create key for unique edge pairs
      const edgeKey = `${rel.actor}|||${rel.target}`;

      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          source: rel.actor,
          target: rel.target,
          action: rel.action,
          location: rel.location || undefined,
          timestamp: rel.timestamp || undefined,
          count: 1
        });
      } else {
        // Increment count for duplicate edge
        edgeMap.get(edgeKey)!.count += 1;
      }
    });

    // Convert edge map to array
    links.push(...Array.from(edgeMap.values()));

    // BFS to calculate distances from Jeffrey Epstein
    const distances = new Map<string, number>();
    const queue: string[] = [];

    if (nodeMap.has(EPSTEIN_NAME)) {
      distances.set(EPSTEIN_NAME, 0);
      queue.push(EPSTEIN_NAME);
    }

    // Build adjacency list
    const adjacency = new Map<string, Set<string>>();
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;

      if (!adjacency.has(sourceId)) adjacency.set(sourceId, new Set());
      if (!adjacency.has(targetId)) adjacency.set(targetId, new Set());

      adjacency.get(sourceId)!.add(targetId);
      adjacency.get(targetId)!.add(sourceId);
    });

    // BFS from Epstein
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDistance = distances.get(current)!;

      const neighbors = adjacency.get(current) || new Set();
      neighbors.forEach(neighbor => {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, currentDistance + 1);
          queue.push(neighbor);
        }
      });
    }

    // Count direct connections TO Epstein for each node
    const directConnectionsToEpstein = new Map<string, number>();
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;

      if (sourceId === EPSTEIN_NAME) {
        directConnectionsToEpstein.set(targetId, (directConnectionsToEpstein.get(targetId) || 0) + 1);
      }
      if (targetId === EPSTEIN_NAME) {
        directConnectionsToEpstein.set(sourceId, (directConnectionsToEpstein.get(sourceId) || 0) + 1);
      }
    });

    const maxDirectToEpstein = Math.max(...Array.from(directConnectionsToEpstein.values()), 1);

    // Calculate average connections per hop distance for density filtering
    const connectionsByHop = new Map<number, number[]>();
    for (const node of nodeMap.values()) {
      const hopDistance = distances.get(node.id) ?? Infinity;
      if (hopDistance !== Infinity) {
        if (!connectionsByHop.has(hopDistance)) {
          connectionsByHop.set(hopDistance, []);
        }
        connectionsByHop.get(hopDistance)!.push(node.val);
      }
    }

    const averageByHop = new Map<number, number>();
    for (const [hop, connections] of connectionsByHop) {
      const avg = connections.reduce((a, b) => a + b, 0) / connections.length;
      averageByHop.set(hop, avg);
    }

    // Filter nodes by density threshold (percentage of average for their hop distance)
    const densityThreshold = minDensity / 100;
    const nodesToKeep = new Set<string>();

    // Always keep Epstein
    nodesToKeep.add(EPSTEIN_NAME);

    // Keep nodes above density threshold
    for (const node of nodeMap.values()) {
      const hopDistance = distances.get(node.id) ?? Infinity;
      const avgForHop = averageByHop.get(hopDistance);

      if (avgForHop !== undefined) {
        const threshold = avgForHop * densityThreshold;
        if (node.val >= threshold) {
          nodesToKeep.add(node.id);
        }
      }
    }

    // Store total connections before density filtering
    const totalConnectionsMap = new Map<string, number>();
    for (const node of nodeMap.values()) {
      totalConnectionsMap.set(node.id, node.val);
    }

    // Filter links to only include nodes we're keeping
    const filteredLinks = links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return nodesToKeep.has(sourceId) && nodesToKeep.has(targetId);
    });

    // Recalculate connection counts after density filtering (sum the count field for deduplicated edges)
    const filteredConnectionsMap = new Map<string, number>();
    for (const node of nodeMap.values()) {
      filteredConnectionsMap.set(node.id, 0);
    }

    filteredLinks.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const count = (link as any).count || 1;
      filteredConnectionsMap.set(sourceId, (filteredConnectionsMap.get(sourceId) || 0) + count);
      filteredConnectionsMap.set(targetId, (filteredConnectionsMap.get(targetId) || 0) + count);
    });

    // Color nodes based on direct connections to Epstein and distance
    const nodes = Array.from(nodeMap.values())
      .filter(node => nodesToKeep.has(node.id))
      .map(node => {
      const distance = distances.get(node.id) ?? Infinity;
      const directCount = directConnectionsToEpstein.get(node.id) || 0;
      let color: string;

      if (node.id === EPSTEIN_NAME) {
        // Epstein himself - red
        color = '#dc2626'; // red-600
      } else if (directCount > 0) {
        // Has direct connections to Epstein - seamless hue gradient based on count
        // ratio 1.0 (max connections) → hue 15 (orange-red)
        // ratio 0.0 (min connections) → hue 45 (yellow)
        const ratio = directCount / maxDirectToEpstein;
        const hue = 45 - (ratio * 30); // Smooth gradient from yellow to orange-red
        color = `hsl(${hue}, 80%, 60%)`; // constant saturation
      } else if (distance === 2 || distance === 3) {
        // No direct connections but close indirect - purple
        color = `hsl(270, 70%, 65%)`; // purple
      } else {
        // Far removed or no connections - green
        color = `hsl(120, 50%, 50%)`; // green
      }

      return {
        ...node,
        val: filteredConnectionsMap.get(node.id) || 0, // Filtered connection count
        totalVal: totalConnectionsMap.get(node.id) || 0, // Total before density filtering
        color,
        baseColor: color // Store base color for resetting
      };
    });

    return {
      nodes,
      links: filteredLinks
    };
  }, [relationships, minDensity]);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.01, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    const g = svg.append('g');

    // Set initial zoom to be more zoomed out
    const initialScale = 0.15;
    const initialTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(initialScale)
      .translate(-width / 2, -height / 2);

    svg.call(zoom).call(zoom.transform as any, initialTransform);

    // Store refs for zoom handling
    zoomRef.current = zoom;
    gRef.current = g;

    // Create square root scale for node sizes
    const minRadius = 5;
    const maxRadius = 100;
    const maxConnections = Math.max(...graphData.nodes.map(n => n.val));
    const radiusScale = d3.scalePow()
      .exponent(0.5)  // Square root scaling
      .domain([1, maxConnections])
      .range([minRadius, maxRadius])
      .clamp(true);

    // Find Epstein node to center around
    const epsteinNode = graphData.nodes.find(n => n.id === 'Jeffrey Epstein');

    // Create simulation
    const simulation = d3.forceSimulation(graphData.nodes as any)
      .force('link', d3.forceLink(graphData.links as any)
        .id((d: any) => d.id)
        .distance(50))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => radiusScale(d.val) + 5))
      .force('radial', d3.forceRadial((d: any) => {
        // Fewer connections = further from center
        // High connection nodes (50+) at ~200px, low connection nodes pushed to ~1800px
        return (50 - Math.min(d.val, 50)) * 33 + 200;
      }, width / 2, height / 2).strength(0.5));

    simulationRef.current = simulation as any;

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', '#4b5563')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6);

    // Store link group ref for later updates
    linkGroupRef.current = link;

    // Create nodes
    const node = g.append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .call(d3.drag<any, GraphNode>()
        .on('start', (event, d: any) => {
          // Don't restart simulation, just fix position
          d.fx = d.x;
          d.fy = d.y;
          (d as any)._dragging = false;
        })
        .on('drag', (event, d: any) => {
          (d as any)._dragging = true;
          d.fx = event.x;
          d.fy = event.y;
          // Only restart simulation if actually dragging
          if (!event.active && (d as any)._dragging) {
            simulation.alphaTarget(0.3).restart();
          }
        })
        .on('end', (event, d: any) => {
          if (!event.active && (d as any)._dragging) {
            simulation.alphaTarget(0);
          }
          d.fx = null;
          d.fy = null;
          (d as any)._dragging = false;
        }) as any);

    // Store node group ref for later updates
    nodeGroupRef.current = node;

    // Add circles
    node.append('circle')
      .attr('r', (d) => radiusScale(d.val))
      .attr('fill', (d) => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onActorClick(d.id);
      });

    // Add labels
    node.append('text')
      .text((d) => d.name)
      .attr('x', 0)
      .attr('y', (d) => radiusScale(d.val) * 1.5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', '5px')
      .attr('font-weight', (d) => d.id === selectedActor ? 'bold' : 'normal')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // Add tooltips
    const tooltip = d3.select('body')
      .append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    node.on('mouseover', async (event, d) => {
      // Get total count from cache or fetch on-demand
      let totalCount = actorTotalCounts[d.name] || onDemandCounts[d.name];

      if (totalCount === undefined) {
        // Show loading state
        tooltip
          .style('visibility', 'visible')
          .html(`<strong>${d.name}</strong><br/>${d.val} connections<br/>(loading total...)`);

        // Fetch on-demand
        try {
          const count = await fetchActorCount(d.name);
          setOnDemandCounts(prev => ({ ...prev, [d.name]: count }));
          totalCount = count;

          // Update tooltip with fetched count
          tooltip
            .html(`<strong>${d.name}</strong><br/>${d.val} connections<br/>(${totalCount} total)`);
        } catch (error) {
          console.error('Error fetching actor count:', error);
          tooltip
            .html(`<strong>${d.name}</strong><br/>${d.val} connections`);
        }
      } else {
        tooltip
          .style('visibility', 'visible')
          .html(`<strong>${d.name}</strong><br/>${d.val} connections<br/>(${totalCount} total)`);
      }
    })
    .on('mousemove', (event) => {
      tooltip
        .style('top', (event.pageY - 10) + 'px')
        .style('left', (event.pageX + 10) + 'px');
    })
    .on('mouseout', () => {
      tooltip.style('visibility', 'hidden');
    });

    link.on('mouseover', (event, d) => {
      const linkData = d as GraphLink & { count?: number };
      const count = linkData.count || 1;
      let html = count > 1
        ? `<strong>${count} relationships</strong><br/>${linkData.action}`
        : `<strong>${linkData.action}</strong>`;
      if (linkData.location) html += `<br/>📍 ${linkData.location}`;
      if (linkData.timestamp) html += `<br/>📅 ${linkData.timestamp}`;
      tooltip
        .style('visibility', 'visible')
        .html(html);
    })
    .on('mousemove', (event) => {
      tooltip
        .style('top', (event.pageY - 10) + 'px')
        .style('left', (event.pageX + 10) + 'px');
    })
    .on('mouseout', () => {
      tooltip.style('visibility', 'hidden');
    });

    // Update positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [graphData]);

  // Separate effect for updating node and link colors when selection changes
  useEffect(() => {
    if (!nodeGroupRef.current || !linkGroupRef.current) return;

    nodeGroupRef.current.selectAll('circle')
      .attr('fill', (d: any) => {
        // Highlight selected actor in cyan, otherwise use base color
        return selectedActor && d.id === selectedActor ? '#06b6d4' : d.baseColor;
      });

    nodeGroupRef.current.selectAll('text')
      .attr('font-weight', (d: any) => d.id === selectedActor ? 'bold' : 'normal');

    linkGroupRef.current
      .attr('stroke', (d: any) => {
        // Highlight links connected to selected actor in cyan
        if (selectedActor) {
          const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
          const targetId = typeof d.target === 'string' ? d.target : d.target.id;
          if (sourceId === selectedActor || targetId === selectedActor) {
            return '#06b6d4';
          }
        }
        return '#4b5563';
      })
      .attr('stroke-opacity', (d: any) => {
        // Also increase opacity for connected links
        if (selectedActor) {
          const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
          const targetId = typeof d.target === 'string' ? d.target : d.target.id;
          if (sourceId === selectedActor || targetId === selectedActor) {
            return 1;
          }
        }
        return 0.6;
      });
  }, [selectedActor]);


  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        className="w-full h-full bg-gray-950"
      />
      {/* Instructions Overlay Banner */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900/50 backdrop-blur-sm px-4 py-2 text-xs text-gray-300 text-center">
        <span>Click nodes to explore relationships</span>
        <span className="mx-3">•</span>
        <span>Scroll to zoom</span>
        <span className="mx-3">•</span>
        <span>Drag to pan</span>
      </div>
    </div>
  );
}
