/**
 * Skill 9: Narrative Constraint Generator
 * 
 * 功能：把Strategy Card转换为Agent 5可用的Narrative约束
 */

function generateConstraints(strategyCard) {
  const { content } = strategyCard;
  const vp = content?.value_proposition || {};
  const narrative = content?.narrative || {};
  
  return {
    narrative_constraints: {
      // 核心主轴
      main_axis: vp.tagline || content.strategic_approach?.type || '企业AI智能体平台',
      
      // 禁止方向
      forbidden_directions: [
        '纯功能介绍（无场景无数据）',
        '没有证据支撑的能力声明',
        '硬广式宣传',
        '对比贬低竞品',
        '绝对化表述（最/第一/唯一）'
      ],
      
      // 鼓励方向
      encouraged_directions: [
        '竞品客观对比（用数据说话）',
        '企业AI落地方法论',
        '真实场景+量化结果',
        '产业趋势判断',
        '客户故事/案例'
      ],
      
      // 内容比例约束
      content_ratio_constraints: {
        竞品对比类: '20-25%',
        企业AI落地方法论: '25-30%',
        真实场景案例: '25-30%',
        行业趋势判断: '15-20%'
      },
      
      // 叙事风格
      narrative_style: {
        tone: vp.tagline ? `围绕"${vp.tagline}"展开` : '专业自信，用数据说话',
        emotional_anchor: '帮助企业主看到AI落地的可行路径',
        brand_voice: content?.brand_policy?.voice || '专业、清晰、有洞察'
      },
      
      // 账号差异化约束
      account_differentiation: {
        '艾氪智能OS': {
          role: 'awareness',
          constraint: '轻产品露出，重行业解释权，建立艾氪判断力',
          narrative_type: '短视频钩子+热点解读'
        },
        '公众号': {
          role: 'trust',
          constraint: '深度内容，完整叙事，可复用资产',
          narrative_type: '完整Narrative（30秒/2分钟/完整版）'
        },
        'JovaAI视频号': {
          role: 'conversion',
          constraint: '产品化叙事，落到真实场景和销售线索',
          narrative_type: '短视频场景Demo+产品价值'
        }
      },
      
      // 短视频钩子约束
      short_video_hooks: {
        must_have: [
          '3秒抓注意力钩子',
          '具体业务场景',
          'JovaAI如何解决问题',
          '可量化的结果'
        ],
        formats: {
          '艾氪洞察': '60-90秒热点解读，无JovaAI露出',
          'AItoB产业观察': '2-3分钟，先产业再产品',
          'JovaAI真实场景': '2-3分钟产品Demo，场景+演示'
        }
      },
      
      // 三账号分发约束
      repurposing_rules: {
        // 从哪个账号发
        source_accounts: {
          '艾氪洞察': ['公众号:全球企业AI案例拆解', 'JovaAI视频号:AItoB产业观察'],
          '公众号': ['知乎', '百家号', '今日头条'],
          'JovaAI视频号': ['公众号:JovaAI真实场景']
        },
        
        // 分发优先级
        priority_order: [
          '高反馈内容 → 公众号深化 → 图文平台',
          '高反馈内容 → 更多角度 → 图文平台',
          '短视频高反馈 → 判断是否深化公众号'
        ]
      }
    },
    
    // 输出给Agent 5的Topic Brief约束
    topic_brief_constraints: {
      must_include: [
        '具体业务场景（不是泛泛的"提升效率"）',
        '可量化的结果指标',
        'JovaAI在这个场景的角色'
      ],
      must_not_include: [
        '未经验证的Claims',
        '绝对化表述',
        '未经授权的客户信息'
      ]
    }
  };
}

// ===== CLI测试 =====
if (require.main === module) {
  const mockCard = require('../mock-data/output-strategy-card.json');
  const constraints = generateConstraints(mockCard);
  
  console.log('\n📋 Skill 9 输出：Narrative约束\n');
  console.log('核心主轴:', constraints.narrative_constraints.main_axis);
  console.log('禁止方向:', constraints.narrative_constraints.forbidden_directions.length, '条');
  console.log('鼓励方向:', constraints.narrative_constraints.encouraged_directions.length, '条');
  console.log('\n账号差异化:');
  Object.entries(constraints.narrative_constraints.account_differentiation).forEach(([acc, val]) => {
    console.log(`  ${acc}: ${val.constraint}`);
  });
  console.log('\n内容比例:');
  Object.entries(constraints.narrative_constraints.content_ratio_constraints).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });
  
  // 写入文件
  require('fs').writeFileSync('../mock-data/narrative-constraints.json', JSON.stringify(constraints, null, 2));
  console.log('\n✅ 已写入 mock-data/narrative-constraints.json');
}

module.exports = { generateConstraints };
