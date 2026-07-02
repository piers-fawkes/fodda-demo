
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GraphNode, GraphEdge, GraphNodeType, Vertical } from '../../shared/types';

// ── Color & Style Constants ───────────────────────────────────────────

const NODE_COLORS: Record<GraphNodeType, string> = {
    Trend: '#6366f1', // indigo
    Brand: '#f59e0b', // amber
    Technology: '#10b981', // emerald
    Audience: '#ec4899', // pink
    Signal: '#3b82f6', // blue
    Article: '#8b5cf6', // violet
};

const NODE_ICONS: Record<GraphNodeType, string> = {
    Trend: '✦',
    Brand: '◆',
    Technology: '⚡',
    Audience: '●',
    Signal: '◎',
    Article: '▣',
};

const RELATIONSHIP_COLORS: Record<string, string> = {
    EVIDENCED_BY: '#6366f180',
    INFLUENCES: '#f59e0b80',
    ACCELERATES: '#10b98180',
    SUPPORTED_BY: '#3b82f680',
    PART_OF: '#ec489980',
    CONTRASTS_WITH: '#ef444480',
    RELATED_TO: '#71717a80',
};

const NODE_RADIUS = 28;
const ANCHOR_RADIUS = 36;
const LABEL_FONT = '11px Inter, system-ui, sans-serif';
const ICON_FONT = '14px Inter, system-ui, sans-serif';

// ── Force Simulation Constants ────────────────────────────────────────

const SPRING_LENGTH = 140;
const SPRING_STRENGTH = 0.004;
const REPULSION = 6000;
const DAMPING = 0.85;
const CENTER_GRAVITY = 0.01;
const SIMULATION_STEPS = 200;

// ── Types ─────────────────────────────────────────────────────────────

interface GraphVisualizationProps {
    isOpen: boolean;
    onClose: () => void;
    anchorNodeId: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
    citedNodeIds: string[];
    vertical: Vertical;
    onExpandNode?: (nodeId: string) => Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
    onAskAbout?: (nodeName: string) => void;
}

interface NodeDetailData {
    node: GraphNode;
    connections: { node: GraphNode; relationship: string; direction: 'in' | 'out' }[];
}

// ── Force Simulation ──────────────────────────────────────────────────

function runForceSimulation(
    nodes: GraphNode[],
    edges: GraphEdge[],
    width: number,
    height: number,
    anchorId: string
): GraphNode[] {
    const simNodes = nodes.map((n, i) => ({
        ...n,
        x: n.x ?? width / 2 + (Math.random() - 0.5) * 200,
        y: n.y ?? height / 2 + (Math.random() - 0.5) * 200,
        vx: n.vx ?? 0,
        vy: n.vy ?? 0,
    }));

    // Pin anchor to center
    const anchorIdx = simNodes.findIndex(n => n.id === anchorId);
    if (anchorIdx >= 0) {
        simNodes[anchorIdx].x = width / 2;
        simNodes[anchorIdx].y = height / 2;
    }

    for (let step = 0; step < SIMULATION_STEPS; step++) {
        // Repulsion between all node pairs
        for (let i = 0; i < simNodes.length; i++) {
            for (let j = i + 1; j < simNodes.length; j++) {
                const dx = simNodes[j].x! - simNodes[i].x!;
                const dy = simNodes[j].y! - simNodes[i].y!;
                const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                const force = REPULSION / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                simNodes[i].vx! -= fx;
                simNodes[i].vy! -= fy;
                simNodes[j].vx! += fx;
                simNodes[j].vy! += fy;
            }
        }

        // Spring attraction along edges
        for (const edge of edges) {
            const si = simNodes.findIndex(n => n.id === edge.source);
            const ti = simNodes.findIndex(n => n.id === edge.target);
            if (si < 0 || ti < 0) continue;
            const dx = simNodes[ti].x! - simNodes[si].x!;
            const dy = simNodes[ti].y! - simNodes[si].y!;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const displacement = dist - SPRING_LENGTH;
            const force = SPRING_STRENGTH * displacement;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            simNodes[si].vx! += fx;
            simNodes[si].vy! += fy;
            simNodes[ti].vx! -= fx;
            simNodes[ti].vy! -= fy;
        }

        // Center gravity
        for (const n of simNodes) {
            n.vx! += (width / 2 - n.x!) * CENTER_GRAVITY;
            n.vy! += (height / 2 - n.y!) * CENTER_GRAVITY;
        }

        // Apply velocity with damping
        for (let i = 0; i < simNodes.length; i++) {
            if (i === anchorIdx) continue; // pin anchor
            simNodes[i].vx! *= DAMPING;
            simNodes[i].vy! *= DAMPING;
            simNodes[i].x! += simNodes[i].vx!;
            simNodes[i].y! += simNodes[i].vy!;
            // Keep within bounds
            simNodes[i].x = Math.max(60, Math.min(width - 60, simNodes[i].x!));
            simNodes[i].y = Math.max(60, Math.min(height - 60, simNodes[i].y!));
        }
    }

    return simNodes;
}

// ── Node Detail Panel ─────────────────────────────────────────────────

function NodeDetailPanel({
    detail,
    onClose,
    onAskAbout,
    citedNodeIds,
}: {
    detail: NodeDetailData;
    onClose: () => void;
    onAskAbout?: (name: string) => void;
    citedNodeIds: string[];
}) {
    const { node, connections } = detail;
    const isCited = citedNodeIds.includes(node.id);
    const color = NODE_COLORS[node.type] || '#71717a';

    return (
        <div className="graph-detail-panel" style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '320px',
            background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
            borderLeft: '1px solid #27272a',
            zIndex: 20, overflowY: 'auto',
            animation: 'slideInRight 0.25s ease-out',
        }}>
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #27272a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <span style={{
                            display: 'inline-block', fontSize: '10px', fontWeight: 700,
                            textTransform: 'uppercase' as const, letterSpacing: '0.1em',
                            color, background: `${color}20`, padding: '2px 8px',
                            borderRadius: '4px', marginBottom: '8px'
                        }}>
                            {NODE_ICONS[node.type]} {node.type}
                            {isCited && <span style={{ marginLeft: '6px', color: '#fbbf24' }}>★ Cited</span>}
                        </span>
                        <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, margin: '4px 0 0 0', lineHeight: 1.3 }}>
                            {node.name}
                        </h3>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#71717a', cursor: 'pointer',
                        fontSize: '18px', padding: '4px', lineHeight: 1
                    }}>✕</button>
                </div>
            </div>

            {/* Summary */}
            {node.summary && (
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a' }}>
                    <div style={{ color: '#a1a1aa', fontSize: '12px', lineHeight: 1.6 }}>
                        {node.summary}
                    </div>
                </div>
            )}

            {/* Connections */}
            {connections.length > 0 && (
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a' }}>
                    <div style={{
                        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const,
                        letterSpacing: '0.1em', color: '#71717a', marginBottom: '10px'
                    }}>
                        Connections ({connections.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {connections.map((c, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '6px 10px', background: '#27272a40', borderRadius: '6px',
                                fontSize: '12px'
                            }}>
                                <span style={{ color: NODE_COLORS[c.node.type] || '#71717a', fontSize: '10px' }}>
                                    {NODE_ICONS[c.node.type]}
                                </span>
                                <span style={{ color: '#e4e4e7', flex: 1 }}>{c.node.name}</span>
                                <span style={{
                                    color: '#52525b', fontSize: '9px', textTransform: 'uppercase' as const,
                                    letterSpacing: '0.05em'
                                }}>
                                    {c.relationship.replace(/_/g, ' ')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ask About Button */}
            {onAskAbout && (
                <div style={{ padding: '16px 20px' }}>
                    <button
                        onClick={() => onAskAbout(node.name)}
                        style={{
                            width: '100%', padding: '10px 16px',
                            background: `${color}20`, border: `1px solid ${color}40`,
                            borderRadius: '8px', color, cursor: 'pointer',
                            fontSize: '12px', fontWeight: 600,
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                            (e.target as HTMLButtonElement).style.background = `${color}30`;
                        }}
                        onMouseLeave={e => {
                            (e.target as HTMLButtonElement).style.background = `${color}20`;
                        }}
                    >
                        Ask about "{node.name}"
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Legend ─────────────────────────────────────────────────────────────

function GraphLegend({ nodeTypes }: { nodeTypes: GraphNodeType[] }) {
    return (
        <div style={{
            position: 'absolute', bottom: '20px', left: '20px',
            display: 'flex', gap: '12px', flexWrap: 'wrap',
            background: '#09090bcc', backdropFilter: 'blur(8px)',
            padding: '8px 14px', borderRadius: '8px', border: '1px solid #27272a'
        }}>
            {nodeTypes.map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: NODE_COLORS[t], display: 'inline-block'
                    }} />
                    <span style={{ color: '#a1a1aa', fontSize: '10px', fontWeight: 500 }}>{t}</span>
                </div>
            ))}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────

export function GraphVisualization({
    isOpen,
    onClose,
    anchorNodeId,
    nodes,
    edges,
    citedNodeIds,
    vertical,
    onExpandNode,
    onAskAbout,
}: GraphVisualizationProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [layoutNodes, setLayoutNodes] = useState<GraphNode[]>([]);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<NodeDetailData | null>(null);
    const [expanding, setExpanding] = useState<string | null>(null);

    // Panning
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    // Run layout when nodes/edges change
    useEffect(() => {
        if (!isOpen || nodes.length === 0) return;
        const container = containerRef.current;
        const w = container?.clientWidth || 900;
        const h = container?.clientHeight || 600;
        const laid = runForceSimulation(nodes, edges, w, h, anchorNodeId);
        setLayoutNodes(laid);
        setPanOffset({ x: 0, y: 0 });
        setZoom(1);
    }, [isOpen, nodes, edges, anchorNodeId]);

    // Transform screen coords to canvas coords
    const screenToCanvas = useCallback((sx: number, sy: number) => {
        return {
            x: (sx - panOffset.x) / zoom,
            y: (sy - panOffset.y) / zoom,
        };
    }, [panOffset, zoom]);

    // Hit test
    const hitTestNode = useCallback((sx: number, sy: number): GraphNode | null => {
        const { x, y } = screenToCanvas(sx, sy);
        for (let i = layoutNodes.length - 1; i >= 0; i--) {
            const n = layoutNodes[i];
            const r = n.id === anchorNodeId ? ANCHOR_RADIUS : NODE_RADIUS;
            const dx = (n.x || 0) - x;
            const dy = (n.y || 0) - y;
            if (dx * dx + dy * dy <= r * r) return n;
        }
        return null;
    }, [layoutNodes, anchorNodeId, screenToCanvas]);

    // Hit test edges
    const hitTestEdge = useCallback((sx: number, sy: number): number | null => {
        const { x, y } = screenToCanvas(sx, sy);
        for (let i = 0; i < edges.length; i++) {
            const src = layoutNodes.find(n => n.id === edges[i].source);
            const tgt = layoutNodes.find(n => n.id === edges[i].target);
            if (!src || !tgt) continue;
            // Point-to-line distance
            const ax = src.x || 0, ay = src.y || 0;
            const bx = tgt.x || 0, by = tgt.y || 0;
            const len = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
            if (len < 1) continue;
            const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (len * len)));
            const px = ax + t * (bx - ax);
            const py = ay + t * (by - ay);
            const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
            if (dist < 8) return i;
        }
        return null;
    }, [layoutNodes, edges, screenToCanvas]);

    // Canvas render
    useEffect(() => {
        if (!isOpen || layoutNodes.length === 0) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const container = containerRef.current;
        const w = container?.clientWidth || 900;
        const h = container?.clientHeight || 600;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Clear
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, w, h);

        // Draw subtle grid
        ctx.save();
        ctx.translate(panOffset.x, panOffset.y);
        ctx.scale(zoom, zoom);

        // Grid dots
        const gridSize = 40;
        ctx.fillStyle = '#1a1a1f';
        for (let gx = -w; gx < w * 2; gx += gridSize) {
            for (let gy = -h; gy < h * 2; gy += gridSize) {
                ctx.fillRect(gx, gy, 1, 1);
            }
        }

        // Draw edges
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            const src = layoutNodes.find(n => n.id === edge.source);
            const tgt = layoutNodes.find(n => n.id === edge.target);
            if (!src || !tgt) continue;

            const isHovered = hoveredEdge === i;
            const isConnectedToHovered = hoveredNode === edge.source || hoveredNode === edge.target;
            const isCitedPath = citedNodeIds.includes(edge.source) && citedNodeIds.includes(edge.target);

            ctx.beginPath();
            ctx.moveTo(src.x || 0, src.y || 0);
            ctx.lineTo(tgt.x || 0, tgt.y || 0);

            if (isCitedPath) {
                ctx.strokeStyle = '#fbbf2440';
                ctx.lineWidth = 2.5;
            } else if (isHovered || isConnectedToHovered) {
                ctx.strokeStyle = RELATIONSHIP_COLORS[edge.relationship] || '#71717a60';
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = '#27272a60';
                ctx.lineWidth = 1;
            }
            ctx.stroke();

            // Edge label on hover
            if (isHovered) {
                const mx = ((src.x || 0) + (tgt.x || 0)) / 2;
                const my = ((src.y || 0) + (tgt.y || 0)) / 2;
                ctx.font = '9px Inter, system-ui, sans-serif';
                ctx.fillStyle = '#a1a1aa';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const label = edge.relationship.replace(/_/g, ' ');

                // Background for label
                const metrics = ctx.measureText(label);
                ctx.fillStyle = '#18181bee';
                ctx.fillRect(mx - metrics.width / 2 - 4, my - 7, metrics.width + 8, 14);
                ctx.fillStyle = '#d4d4d8';
                ctx.fillText(label, mx, my);
            }
        }

        // Draw nodes
        for (const node of layoutNodes) {
            const isAnchor = node.id === anchorNodeId;
            const isCited = citedNodeIds.includes(node.id);
            const isHovered = hoveredNode === node.id;
            const color = NODE_COLORS[node.type] || '#71717a';
            const radius = isAnchor ? ANCHOR_RADIUS : NODE_RADIUS;
            const x = node.x || 0;
            const y = node.y || 0;

            // Glow for cited nodes
            if (isCited) {
                ctx.beginPath();
                ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
                const glow = ctx.createRadialGradient(x, y, radius, x, y, radius + 12);
                glow.addColorStop(0, `${color}30`);
                glow.addColorStop(1, 'transparent');
                ctx.fillStyle = glow;
                ctx.fill();
            }

            // Node circle
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);

            // Fill
            if (isAnchor) {
                const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, radius);
                grad.addColorStop(0, color);
                grad.addColorStop(1, `${color}90`);
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = isHovered ? `${color}30` : '#18181b';
            }
            ctx.fill();

            // Border
            ctx.strokeStyle = isHovered ? color : `${color}60`;
            ctx.lineWidth = isAnchor ? 2.5 : isHovered ? 2 : 1.5;
            ctx.stroke();

            // Icon
            ctx.font = isAnchor ? '16px Inter, system-ui, sans-serif' : ICON_FONT;
            ctx.fillStyle = isAnchor ? '#fff' : color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(NODE_ICONS[node.type] || '●', x, y - (isAnchor ? 2 : 0));

            // Label
            ctx.font = isAnchor ? 'bold 11px Inter, system-ui, sans-serif' : LABEL_FONT;
            ctx.fillStyle = isAnchor || isHovered ? '#fff' : '#a1a1aa';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Truncate label
            let label = node.name;
            if (label.length > 22) label = label.substring(0, 20) + '…';
            ctx.fillText(label, x, y + radius + 6);
        }

        ctx.restore();
    }, [layoutNodes, edges, hoveredNode, hoveredEdge, panOffset, zoom, anchorNodeId, citedNodeIds, isOpen]);

    // Mouse handlers
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (isDragging.current) {
            setPanOffset(prev => ({
                x: prev.x + (e.clientX - lastMouse.current.x),
                y: prev.y + (e.clientY - lastMouse.current.y),
            }));
            lastMouse.current = { x: e.clientX, y: e.clientY };
            return;
        }

        const node = hitTestNode(sx, sy);
        setHoveredNode(node?.id || null);

        if (!node) {
            const edgeIdx = hitTestEdge(sx, sy);
            setHoveredEdge(edgeIdx);
        } else {
            setHoveredEdge(null);
        }

        if (canvasRef.current) {
            canvasRef.current.style.cursor = node ? 'pointer' : 'grab';
        }
    }, [hitTestNode, hitTestEdge]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const node = hitTestNode(sx, sy);

        if (!node) {
            isDragging.current = true;
            lastMouse.current = { x: e.clientX, y: e.clientY };
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        }
    }, [hitTestNode]);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    }, []);

    const handleClick = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const node = hitTestNode(sx, sy);

        if (node) {
            // Build connections
            const connections = edges
                .filter(edge => edge.source === node.id || edge.target === node.id)
                .map(edge => {
                    const otherId = edge.source === node.id ? edge.target : edge.source;
                    const otherNode = layoutNodes.find(n => n.id === otherId);
                    if (!otherNode) return null;
                    return {
                        node: otherNode,
                        relationship: edge.relationship,
                        direction: edge.source === node.id ? 'out' as const : 'in' as const,
                    };
                })
                .filter(Boolean) as { node: GraphNode; relationship: string; direction: 'in' | 'out' }[];

            setSelectedDetail({ node, connections });
        } else {
            setSelectedDetail(null);
        }
    }, [hitTestNode, edges, layoutNodes]);

    const handleDoubleClick = useCallback(async (e: React.MouseEvent) => {
        if (!onExpandNode) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const node = hitTestNode(sx, sy);

        if (node && node.id !== anchorNodeId) {
            setExpanding(node.id);
            try {
                await onExpandNode(node.id);
            } finally {
                setExpanding(null);
            }
        }
    }, [hitTestNode, onExpandNode, anchorNodeId]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.92 : 1.08;
        setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)));
    }, []);

    // ── Export Handlers ──────────────────────────────────────────────────

    const handleExportPNG = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `fodda-graph-${vertical.toLowerCase()}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, [vertical]);

    const handleExportJSON = useCallback(() => {
        const data = {
            vertical,
            anchorNodeId,
            exportedAt: new Date().toISOString(),
            nodes: layoutNodes.map(n => ({
                id: n.id,
                name: n.name,
                type: n.type,
                summary: n.summary || undefined,
                metadata: n.metadata || undefined,
            })),
            edges: edges.map(e => ({
                source: e.source,
                target: e.target,
                relationship: e.relationship,
            })),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `fodda-graph-${vertical.toLowerCase()}-${Date.now()}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    }, [vertical, anchorNodeId, layoutNodes, edges]);

    if (!isOpen) return null;

    // Get unique node types for legend
    const nodeTypes = [...new Set(nodes.map(n => n.type))];

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 100,
                background: '#09090bf0', backdropFilter: 'blur(12px)',
                display: 'flex', flexDirection: 'column',
                animation: 'fadeIn 0.2s ease-out',
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', borderBottom: '1px solid #27272a',
                background: '#18181b80',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                        <circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" />
                        <line x1="12" y1="8" x2="5" y2="16" /><line x1="12" y1="8" x2="19" y2="16" />
                    </svg>
                    <h2 style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: 0 }}>
                        Connection Map
                    </h2>
                    <span style={{
                        fontSize: '11px', color: '#71717a', fontWeight: 500,
                        background: '#27272a', padding: '2px 8px', borderRadius: '4px'
                    }}>
                        {nodes.length} nodes · {edges.length} connections
                    </span>
                    {expanding && (
                        <span style={{ fontSize: '11px', color: '#6366f1' }}>
                            Expanding…
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Export buttons */}
                    <button onClick={handleExportPNG} style={{
                        background: 'none', border: '1px solid #3f3f46',
                        color: '#a1a1aa', cursor: 'pointer', padding: '5px 10px',
                        borderRadius: '6px', fontSize: '10px', fontWeight: 600,
                        letterSpacing: '0.05em', textTransform: 'uppercase' as const,
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                        onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#fff'; (e.target as HTMLButtonElement).style.borderColor = '#71717a'; }}
                        onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#a1a1aa'; (e.target as HTMLButtonElement).style.borderColor = '#3f3f46'; }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="m21 15-5-5L5 21" />
                        </svg>
                        PNG
                    </button>
                    <button onClick={handleExportJSON} style={{
                        background: 'none', border: '1px solid #3f3f46',
                        color: '#a1a1aa', cursor: 'pointer', padding: '5px 10px',
                        borderRadius: '6px', fontSize: '10px', fontWeight: 600,
                        letterSpacing: '0.05em', textTransform: 'uppercase' as const,
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                        onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#fff'; (e.target as HTMLButtonElement).style.borderColor = '#71717a'; }}
                        onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#a1a1aa'; (e.target as HTMLButtonElement).style.borderColor = '#3f3f46'; }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        JSON
                    </button>
                    <button onClick={onClose} style={{
                        background: '#27272a', border: '1px solid #3f3f46',
                        color: '#a1a1aa', cursor: 'pointer', padding: '6px 14px',
                        borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                        transition: 'all 0.15s',
                    }}
                        onMouseEnter={e => {
                            (e.target as HTMLButtonElement).style.color = '#fff';
                            (e.target as HTMLButtonElement).style.borderColor = '#71717a';
                        }}
                        onMouseLeave={e => {
                            (e.target as HTMLButtonElement).style.color = '#a1a1aa';
                            (e.target as HTMLButtonElement).style.borderColor = '#3f3f46';
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    onMouseMove={handleMouseMove}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onClick={handleClick}
                    onDoubleClick={handleDoubleClick}
                    onWheel={handleWheel}
                    style={{ display: 'block', width: '100%', height: '100%' }}
                />

                {/* Legend */}
                <GraphLegend nodeTypes={nodeTypes} />

                {/* Hint */}
                <div style={{
                    position: 'absolute', bottom: '20px', right: selectedDetail ? '340px' : '20px',
                    color: '#52525b', fontSize: '10px',
                    background: '#09090bcc', backdropFilter: 'blur(8px)',
                    padding: '6px 12px', borderRadius: '6px', border: '1px solid #27272a',
                    transition: 'right 0.25s ease',
                }}>
                    Click node for details · Double-click to expand · Scroll to zoom · Drag to pan
                </div>

                {/* Node Detail Side Panel */}
                {selectedDetail && (
                    <NodeDetailPanel
                        detail={selectedDetail}
                        onClose={() => setSelectedDetail(null)}
                        onAskAbout={onAskAbout}
                        citedNodeIds={citedNodeIds}
                    />
                )}
            </div>

            {/* Inline styles for animations */}
            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(320px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
        </div>
    );
}
