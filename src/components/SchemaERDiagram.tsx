import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { DatabaseTable } from '@/types/project';

interface SchemaERDiagramProps {
  tables: DatabaseTable[];
}

type TableNode = {
  name: string;
  columns: { name: string; type: string; isPK: boolean; isFK: boolean; ref?: string }[];
  x: number;
  y: number;
  width: number;
  height: number;
};

type Relation = {
  from: string;
  fromCol: string;
  to: string;
  toCol: string;
  onDelete?: string;
};

const NODE_PADDING = 16;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 22;
const MIN_NODE_WIDTH = 160;
const FONT_SIZE = 11;
const HEADER_FONT_SIZE = 12;

const SchemaERDiagram = ({ tables }: SchemaERDiagramProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Compute relations from column references
  const relations = useMemo<Relation[]>(() => {
    const rels: Relation[] = [];
    for (const table of tables) {
      for (const col of table.columns) {
        if (col.references) {
          const match = col.references.match(/^(\w+)\((\w+)\)$/);
          if (match) {
            rels.push({
              from: table.name,
              fromCol: col.name,
              to: match[1],
              toCol: match[2],
              onDelete: col.on_delete,
            });
          }
        }
      }
    }
    return rels;
  }, [tables]);

  // Layout nodes in a grid
  const nodes = useMemo<TableNode[]>(() => {
    const cols = Math.max(2, Math.ceil(Math.sqrt(tables.length)));
    const GAP_X = 280;
    const GAP_Y = 40;

    return tables.map((table, idx) => {
      const maxColName = Math.max(...table.columns.map(c => c.name.length), table.name.length);
      const maxType = Math.max(...table.columns.map(c => c.type.length));
      const estimatedWidth = Math.max(MIN_NODE_WIDTH, (maxColName + maxType + 6) * 7);
      const height = HEADER_HEIGHT + table.columns.length * ROW_HEIGHT + 8;

      const gridCol = idx % cols;
      const gridRow = Math.floor(idx / cols);

      // Compute y offset based on actual heights of tables above
      let y = 0;
      for (let r = 0; r < gridRow; r++) {
        const rowTables = tables.slice(r * cols, (r + 1) * cols);
        const maxH = Math.max(...rowTables.map(t => HEADER_HEIGHT + t.columns.length * ROW_HEIGHT + 8));
        y += maxH + GAP_Y;
      }

      return {
        name: table.name,
        columns: table.columns.map(c => ({
          name: c.name,
          type: c.type,
          isPK: !!c.primary_key,
          isFK: !!c.references,
          ref: c.references,
        })),
        x: gridCol * GAP_X,
        y,
        width: estimatedWidth,
        height,
      };
    });
  }, [tables]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(500, entry.contentRect.height),
        });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Get theme colors from CSS variables
    const style = getComputedStyle(document.documentElement);
    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = isDark ? '#0f1219' : '#f5f6f8';
    const cardBg = isDark ? '#1a1f2e' : '#ffffff';
    const borderColor = isDark ? '#2a3040' : '#e2e4e9';
    const headerBg = isDark ? '#1e2636' : '#f0fdf4';
    const textColor = isDark ? '#e0e4ec' : '#1a1a2e';
    const mutedText = isDark ? '#7a8599' : '#6b7280';
    const primaryColor = '#22c55e';
    const pkColor = '#eab308';
    const fkColor = '#3b82f6';
    const hoverBorder = primaryColor;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw relations first (behind nodes)
    for (const rel of relations) {
      const fromNode = nodes.find(n => n.name === rel.from);
      const toNode = nodes.find(n => n.name === rel.to);
      if (!fromNode || !toNode) continue;

      const fromColIdx = fromNode.columns.findIndex(c => c.name === rel.fromCol);
      const toColIdx = toNode.columns.findIndex(c => c.name === rel.toCol);

      const fromX = fromNode.x + fromNode.width;
      const fromY = fromNode.y + HEADER_HEIGHT + fromColIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const toX = toNode.x;
      const toY = toNode.y + HEADER_HEIGHT + toColIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

      // Determine if highlighted
      const isHighlighted = hoveredTable === rel.from || hoveredTable === rel.to;

      ctx.strokeStyle = isHighlighted ? primaryColor : (isDark ? '#3a4560' : '#c4cad4');
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.setLineDash(rel.onDelete === 'CASCADE' ? [] : [4, 3]);

      // Bezier curve
      const cpOffset = Math.min(80, Math.abs(fromX - toX) * 0.4);
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.bezierCurveTo(fromX + cpOffset, fromY, toX - cpOffset, toY, toX, toY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow head at target
      const angle = Math.atan2(toY - (toY), toX - (toX - cpOffset));
      const arrowLen = 7;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - arrowLen * Math.cos(angle - 0.4), toY - arrowLen * Math.sin(angle - 0.4));
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - arrowLen * Math.cos(angle + 0.4), toY - arrowLen * Math.sin(angle + 0.4));
      ctx.stroke();

      // Diamond at source (FK indicator)
      ctx.beginPath();
      ctx.arc(fromX, fromY, 3, 0, Math.PI * 2);
      ctx.fillStyle = isHighlighted ? primaryColor : fkColor;
      ctx.fill();
    }

    // Draw nodes
    for (const node of nodes) {
      const isHovered = hoveredTable === node.name;

      // Shadow
      ctx.shadowColor = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = isHovered ? 12 : 6;
      ctx.shadowOffsetY = 2;

      // Card body
      ctx.fillStyle = cardBg;
      ctx.strokeStyle = isHovered ? hoverBorder : borderColor;
      ctx.lineWidth = isHovered ? 2 : 1;
      roundRect(ctx, node.x, node.y, node.width, node.height, 8);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Header
      ctx.fillStyle = headerBg;
      roundRectTop(ctx, node.x, node.y, node.width, HEADER_HEIGHT, 8);
      ctx.fill();

      // Header border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y + HEADER_HEIGHT);
      ctx.lineTo(node.x + node.width, node.y + HEADER_HEIGHT);
      ctx.stroke();

      // Table name
      ctx.fillStyle = primaryColor;
      ctx.font = `bold ${HEADER_FONT_SIZE}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name, node.x + 10, node.y + HEADER_HEIGHT / 2);

      // Column count badge
      const countText = `${node.columns.length}`;
      const countWidth = ctx.measureText(countText).width + 10;
      ctx.fillStyle = isDark ? '#2a3040' : '#e5e7eb';
      roundRect(ctx, node.x + node.width - countWidth - 8, node.y + 8, countWidth, 16, 4);
      ctx.fill();
      ctx.fillStyle = mutedText;
      ctx.font = `${10}px "JetBrains Mono", monospace`;
      ctx.fillText(countText, node.x + node.width - countWidth - 3, node.y + 17);

      // Columns
      node.columns.forEach((col, i) => {
        const y = node.y + HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2;

        // PK/FK indicator
        if (col.isPK) {
          ctx.fillStyle = pkColor;
          ctx.font = `bold 8px sans-serif`;
          ctx.fillText('PK', node.x + 6, y + 1);
        } else if (col.isFK) {
          ctx.fillStyle = fkColor;
          ctx.font = `bold 8px sans-serif`;
          ctx.fillText('FK', node.x + 6, y + 1);
        }

        // Column name
        ctx.fillStyle = textColor;
        ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`;
        ctx.fillText(col.name, node.x + 26, y + 1);

        // Column type
        ctx.fillStyle = mutedText;
        ctx.font = `${FONT_SIZE - 1}px "JetBrains Mono", monospace`;
        const typeX = node.x + node.width - ctx.measureText(col.type).width - 10;
        ctx.fillText(col.type, typeX, y + 1);
      });
    }

    ctx.restore();

    // Zoom indicator
    ctx.fillStyle = mutedText;
    ctx.font = '11px sans-serif';
    ctx.fillText(`${Math.round(zoom * 100)}%`, 10, dimensions.height - 10);
  }, [nodes, relations, pan, zoom, dimensions, hoveredTable]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPan({
        x: dragging.panX + (e.clientX - dragging.startX),
        y: dragging.panY + (e.clientY - dragging.startY),
      });
      return;
    }

    // Hit-test for hover
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;

    const hit = nodes.find(n =>
      mx >= n.x && mx <= n.x + n.width && my >= n.y && my <= n.y + n.height
    );
    setHoveredTable(hit?.name || null);
  };

  const handleMouseUp = () => setDragging(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(3, z * delta)));
  };

  const resetView = () => { setPan({ x: 40, y: 40 }); setZoom(1); };

  return (
    <div ref={containerRef} className="relative w-full h-[500px] rounded-lg border border-border overflow-hidden bg-muted/30">
      <canvas
        ref={canvasRef}
        className="cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setHoveredTable(null); }}
        onWheel={handleWheel}
      />
      <div className="absolute top-3 right-3 flex gap-1">
        <button
          onClick={() => setZoom(z => Math.min(3, z * 1.2))}
          className="h-7 w-7 rounded bg-background/80 border border-border text-xs font-bold flex items-center justify-center hover:bg-background"
        >+</button>
        <button
          onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}
          className="h-7 w-7 rounded bg-background/80 border border-border text-xs font-bold flex items-center justify-center hover:bg-background"
        >−</button>
        <button
          onClick={resetView}
          className="h-7 px-2 rounded bg-background/80 border border-border text-[10px] flex items-center justify-center hover:bg-background"
        >Reset</button>
      </div>
      <div className="absolute bottom-3 left-3 flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" /> PK</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> FK</span>
        <span className="flex items-center gap-1"><span className="h-3 border-t border-muted-foreground inline-block w-4" /> Relation</span>
        <span className="flex items-center gap-1"><span className="h-3 border-t border-dashed border-muted-foreground inline-block w-4" /> SET NULL</span>
      </div>
    </div>
  );
};

// Canvas helpers
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default SchemaERDiagram;
