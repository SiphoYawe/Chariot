"use client";

import { useMemo } from "react";
import type { Transaction } from "@/types/transaction";

interface AssetFlowSankeyProps {
  transactions: Transaction[];
}

interface SankeyNode {
  id: string;
  label: string;
  value: number;
  color: string;
  x: number;
  y: number;
  height: number;
}

interface SankeyLink {
  from: string;
  to: string;
  value: number;
  color: string;
}

const NODE_W = 120;
const NODE_PAD = 8;
const SVG_H = 280;
const SVG_W = 600;

function buildSankey(transactions: Transaction[]): { nodes: SankeyNode[]; links: SankeyLink[] } {
  let deposited = 0, withdrawn = 0, borrowed = 0, repaid = 0;
  for (const tx of transactions) {
    if (tx.type === "deposit") deposited += tx.amount;
    if (tx.type === "withdrawal") withdrawn += tx.amount;
    if (tx.type === "borrow") borrowed += tx.amount;
    if (tx.type === "repay") repaid += tx.amount;
  }

  const totalFlow = deposited + borrowed;
  if (totalFlow === 0) return { nodes: [], links: [] };

  const scale = (SVG_H - 60) / totalFlow;

  const col0 = 0;
  const col1 = (SVG_W - NODE_W) / 2;
  const col2 = SVG_W - NODE_W;

  const sources: SankeyNode[] = [];
  let srcY = 20;
  if (deposited > 0) {
    sources.push({ id: "deposited", label: "Deposited", value: deposited, color: "#037971", x: col0, y: srcY, height: deposited * scale - NODE_PAD });
    srcY += deposited * scale;
  }
  if (borrowed > 0) {
    sources.push({ id: "borrowed", label: "Borrowed", value: borrowed, color: "#F59E0B", x: col0, y: srcY, height: borrowed * scale - NODE_PAD });
  }

  const vaultH = totalFlow * scale - NODE_PAD;
  const vault: SankeyNode = { id: "vault", label: "Vault Activity", value: totalFlow, color: "#03B5AA", x: col1, y: 20, height: vaultH };

  const dests: SankeyNode[] = [];
  let dstY = 20;
  if (withdrawn > 0) {
    dests.push({ id: "withdrawn", label: "Withdrawn", value: withdrawn, color: "#16A34A", x: col2, y: dstY, height: withdrawn * scale - NODE_PAD });
    dstY += withdrawn * scale;
  }
  if (repaid > 0) {
    dests.push({ id: "repaid", label: "Repaid", value: repaid, color: "#6B8A8D", x: col2, y: dstY, height: repaid * scale - NODE_PAD });
    dstY += repaid * scale;
  }
  const inVault = totalFlow - withdrawn - repaid;
  if (inVault > 0) {
    dests.push({ id: "in_vault", label: "In Protocol", value: inVault, color: "#023436", x: col2, y: dstY, height: inVault * scale - NODE_PAD });
  }

  const nodes = [...sources, vault, ...dests];

  const links: SankeyLink[] = [];
  for (const src of sources) {
    links.push({ from: src.id, to: "vault", value: src.value, color: src.color });
  }
  for (const dst of dests) {
    links.push({ from: "vault", to: dst.id, value: dst.value, color: dst.color });
  }

  return { nodes, links };
}

function sankeyPath(
  fromNode: SankeyNode,
  toNode: SankeyNode,
  value: number,
  scale: number,
  fromOffset: number,
  toOffset: number
): string {
  const linkH = value * scale;
  const x0 = fromNode.x + NODE_W;
  const x1 = toNode.x;
  const y0 = fromNode.y + fromOffset;
  const y1 = toNode.y + toOffset;
  const mx = (x0 + x1) / 2;
  return `M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1} L ${x1} ${y1 + linkH} C ${mx} ${y1 + linkH}, ${mx} ${y0 + linkH}, ${x0} ${y0 + linkH} Z`;
}

export function AssetFlowSankey({ transactions }: AssetFlowSankeyProps) {
  const { nodes, links } = useMemo(() => buildSankey(transactions), [transactions]);

  if (nodes.length === 0 || transactions.length === 0) return null;

  const vaultNode = nodes.find((n) => n.id === "vault");
  const totalFlow = vaultNode?.value ?? 1;
  const scale = (SVG_H - 60) / totalFlow;

  const fromOffsets = new Map<string, number>();
  const toOffsets = new Map<string, number>();
  nodes.forEach((n) => { fromOffsets.set(n.id, 0); toOffsets.set(n.id, 0); });

  const linkPaths = links.map((link) => {
    const fromNode = nodes.find((n) => n.id === link.from)!;
    const toNode = nodes.find((n) => n.id === link.to)!;
    const fo = fromOffsets.get(link.from) ?? 0;
    const to = toOffsets.get(link.to) ?? 0;
    const path = sankeyPath(fromNode, toNode, link.value, scale, fo, to);
    fromOffsets.set(link.from, fo + link.value * scale);
    toOffsets.set(link.to, to + link.value * scale);
    return { ...link, path };
  });

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Asset Flow
        </h3>
        <span className="text-xs text-[#6B8A8D]">USDC flows across your protocol activity</span>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ maxHeight: SVG_H }}>
          {linkPaths.map((link) => (
            <path
              key={`${link.from}-${link.to}`}
              d={link.path}
              fill={link.color}
              fillOpacity={0.2}
              stroke={link.color}
              strokeOpacity={0.4}
              strokeWidth={0.5}
            />
          ))}

          {nodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={Math.max(node.height, 4)}
                fill={node.color}
                rx={2}
              />
              <text
                x={node.x + NODE_W / 2}
                y={node.y + Math.max(node.height, 4) / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight={600}
                fill="white"
              >
                {node.label}
              </text>
              <text
                x={node.x + NODE_W / 2}
                y={node.y + Math.max(node.height, 4) + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#6B8A8D"
              >
                ${node.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
