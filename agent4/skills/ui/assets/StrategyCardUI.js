/**
 * Agent 4 Strategy Card UI Component
 * 
 * 支持 items 数组:
 * { label, value, status: 'pass'|'warn'|'fail' }
 * 
 * 访问路径: /__jova__/skills/risen-agent4/StrategyCard.js
 */

import React from "react";

const STATUS_COLORS = {
  pass:  { bg: '#dcfce7', border: '#86efac', text: '#166534', icon: '✓' },
  warn:  { bg: '#fef9c3', border: '#fde047', text: '#854d0e', icon: '⚠' },
  fail:  { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', icon: '✗' },
};

const STATUS_DEFAULT = { bg: '#f3f4f6', border: '#e5e7eb', text: '#6b7280', icon: '○' };

function ItemRow({ label, value, status }) {
  const s = STATUS_COLORS[status] || STATUS_DEFAULT;
  return React.createElement(
    "tr",
    null,
    React.createElement("td", {
      style: { padding: "6px 12px", fontSize: "13px", color: "#374151", fontWeight: 500, whiteSpace: "nowrap" }
    }, label),
    React.createElement("td", {
      style: { padding: "6px 12px", fontSize: "13px", color: "#111827", width: "100%" }
    }, value),
    React.createElement("td", {
      style: { padding: "6px 8px" }
    },
      React.createElement("span", {
        style: {
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, borderRadius: "50%",
          backgroundColor: s.bg, color: s.text,
          fontSize: "11px", fontWeight: 700
        }
      }, s.icon)
    )
  );
}

function StrategyCardUI(props) {
  const {
    title = "Strategy Card",
    subtitle = "",
    items = [],
    description = ""
  } = props || {};

  const headerBg = "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)";

  return React.createElement(
    "div",
    {
      style: {
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 560,
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        backgroundColor: "#ffffff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        overflow: "hidden",
        margin: "8px 0"
      }
    },
    // Header
    React.createElement("div", {
      style: { background: headerBg, padding: "16px 20px" }
    },
      React.createElement("div", {
        style: { fontSize: "16px", fontWeight: 700, color: "#ffffff", marginBottom: subtitle ? "4px" : 0 }
      }, title),
      subtitle
        ? React.createElement("div", { style: { fontSize: "12px", color: "rgba(255,255,255,0.75)" } }, subtitle)
        : null
    ),
    // Description
    description
      ? React.createElement("div", {
          style: { padding: "10px 20px", fontSize: "13px", color: "#6b7280", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }
        }, description)
      : null,
    // Items table
    React.createElement("table", {
      style: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }
    },
      React.createElement("tbody", null,
        items.map((item, i) =>
          React.createElement(ItemRow, { key: i, ...item })
        )
      )
    )
  );
}

export default StrategyCardUI;
