#!/usr/bin/env python3
"""
Agent 4 Strategy Report — Python版本
绕过 chalk v5 ESM 问题，提供可读的 CLI 报告

使用方法:
    python3 agent4-report.py
"""
import json
import sys
from pathlib import Path

def main():
    base = Path(__file__).parent
    data_path = base / 'mock-data' / 'agent4-full-output.json'

    try:
        data = json.loads(data_path.read_text())
    except FileNotFoundError:
        print(f"错误: 找不到 {data_path}")
        print("请先运行: node agent4-full-pipeline.js")
        sys.exit(1)

    card = data.get('strategy_card', {})

    print("\n" + "=" * 56)
    print("Agent 4 Strategy Card Report")
    print("=" * 56)
    print(f"版本:    {card.get('version', 'N/A')}")
    print(f"状态:    {card.get('status', 'N/A')}")
    print(f"产品:    {card.get('promoted_object', 'N/A')}")
    print(f"业务目标: {card.get('business_objective', 'N/A')}")
    print(f"目标市场: {card.get('target_market', 'N/A')}")

    # ── Narrative 主轴 ──────────────────────────────────
    narrative = card.get('content', {}).get('narrative', {})
    main_axis = narrative.get('main_axis') or narrative.get('tagline') or 'N/A'
    print(f"\n核心主轴: {main_axis}")

    # ── 价值主张 ──────────────────────────────────────
    vp = card.get('content', {}).get('value_proposition', {})
    tagline = vp.get('tagline', 'N/A')
    claims = vp.get('claims', [])
    print(f"价值主张: {tagline}")
    print(f"Claims:   {len(claims)}条")
    if claims:
        for c in claims[:3]:
            print(f"  - {c.get('statement', c)[:60]}")

    # ── 渠道组合 ────────────────────────────────────────
    channels = card.get('channel_mix', [])
    print(f"\n渠道数:  {len(channels)}")
    for ch in channels[:8]:
        name = ch.get('channel_name', 'N/A')
        ratio = ch.get('budget_ratio', 0) * 100
        print(f"  {name:22s} {ratio:5.1f}%")

    # ── 预算与周期 ────────────────────────────────────
    budget = card.get('budget_ceiling', 0)
    weeks = card.get('experiment_duration_weeks', 'N/A')
    print(f"\n预算上限: ¥{budget:,.0f}")
    print(f"实验周期: {weeks}周")

    # ── Stop/Scale 条件 ──────────────────────────────
    stop = card.get('stop_conditions', {})
    scale = card.get('scale_conditions', {})
    success = card.get('success_threshold', {})

    print(f"\n成功条件: ROI > {success.get('roi', 'N/A')}x")
    print(f"  置信度 > {success.get('confidence', 'N/A')}")
    print(f"  样本量 > {success.get('min_sample_size', 'N/A')}")
    print(f"停止条件: ROI < {stop.get('roi_threshold', 'N/A')}")
    print(f"放大条件: ROI > {scale.get('roi_multiplier', 'N/A')}x")

    # ── Feedback Router ───────────────────────────────
    print("\n" + "=" * 56)
    print("Feedback Router 决策")
    print("=" * 56)

    fd = data.get('feedback_decisions', {})
    print(f"深化选题: {len(fd.get('topic_deepening', []))} 条")
    for td in fd.get('topic_deepening', [])[:3]:
        cid = td.get('content_id', 'N/A')
        platform = td.get('platform', 'N/A')
        print(f"  {cid} ({platform})")

    print(f"策略调整: {len(fd.get('strategy_adjustments', []))} 条")
    for sa in fd.get('strategy_adjustments', [])[:3]:
        cid = sa.get('content_id', 'N/A')
        action = sa.get('action', 'N/A')
        print(f"  {cid}: {action}")

    ev = data.get('evolution', {})
    v_from = ev.get('version_from', 'N/A')
    v_to = ev.get('version_to', 'N/A')
    changes = ev.get('changes_count', 0)
    print(f"策略进化: {v_from} → {v_to} ({changes}项变更)")

    # ── Narrative约束（三账号）─────────────────────────
    print("\n" + "=" * 56)
    print("Narrative约束（三账号）")
    print("=" * 56)

    nc = data.get('narrative_constraints', {})

    # 扩展版结构（合并后）
    three_acct = (
        nc.get('three_account_strategy', {}).get('accounts') or
        nc.get('narrative_constraints', {}).get('account_differentiation') or
        {}
    )

    if isinstance(three_acct, dict) and three_acct:
        for name, info in three_acct.items():
            if isinstance(info, dict):
                role = info.get('role', 'N/A')
                desc = (
                    info.get('description') or
                    info.get('constraint', 'N/A')
                )
                print(f"  {name} ({role})")
                print(f"    {desc}")
    else:
        print("  (三账号约束结构待确认)")

    # 内容比例
    content_ratio = (
        nc.get('narrative_constraints', {}).get('content_ratio_constraints') or
        nc.get('three_account_strategy', {}).get('accounts', {}) or {}
    )
    if isinstance(content_ratio, dict) and '竞品对比类' in content_ratio:
        print("\n  内容比例:")
        for k, v in content_ratio.items():
            print(f"    {k}: {v}")

    # 禁止方向
    forbidden = (
        nc.get('narrative_constraints', {}).get('forbidden_directions') or
        []
    )
    if forbidden:
        print(f"\n  禁止方向: {', '.join(forbidden[:3])}")

    print("\n" + "=" * 56)

if __name__ == '__main__':
    main()
