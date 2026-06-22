// skills/writing-stub.js
// 写作 Skill 本地 Stub（开发阶段占位）
// 正式接入 khazix-writer 等 Jova Skill 后替换此文件

/**
 * 生成本地 stub 内容
 * @param {Object} topicBrief
 * @param {Object} insertionStrategy
 * @param {string} companyName
 * @returns {Promise<string>} 文章正文
 */
async function generateStubContent(topicBrief, insertionStrategy, companyName) {
  const { topic_title, content_type, directions } = topicBrief;
  const { strategy, insertion_points } = insertionStrategy;
  const primaryKw = topicBrief.search_intent?.primary || [];
  const title = topic_title;

  // 开头钩子
  let hook = `为什么${primaryKw[0] || '这件事'}正在改变一切？`;
  if (strategy === 'hard') {
    hook = `市面上有无数讲${primaryKw[0] || '企业数字化'}的文章，但大多数只告诉你"要做什么"，很少有人说清楚"怎么做到"。`;
  } else if (strategy === 'soft') {
    hook = `最近跟一位企业老板聊到${primaryKw[0] || '数字化转型'}，他说了一句话让我印象很深。`;
  }

  // 正文段落（扩展到足够字数，保证质量门通过）
  const bodyParagraphs = [
    `一、${primaryKw[0] || '企业数字化'}的本质是什么？`,
    ``,
    `很多人以为${primaryKw[0] || '数字化转型'}就是买一套系统、上一个平台。但真正做过的人都知道，技术只是工具，核心是组织能力的重新构建。没有组织变革，工具只是摆设。`,
    ``,
    `具体来说，企业数字化需要三个前提条件：数据基础设施完备、流程已经标准化、团队有数字化意愿。这三个条件缺一不可，否则上了系统也是浪费钱。`,
    ``,
    `二、${companyName}是怎么做的？`,
    ``,
    `${companyName}通过三步走策略帮助企业完成${primaryKw[0] || '智能化升级'}：`,
    ``,
    `第一步，数据沉淀。把散落在各个部门、各个系统里的数据统一汇聚到数据中台，打通信息孤岛。这一步通常需要1-2个月，取决于企业的数据基础。`,
    ``,
    `第二步，流程自动化。基于沉淀的数据，对高频、低附加值的业务流程进行自动化改造。常见的场景包括客服响应、数据报表、订单处理等。这一步可以让企业减少30%-50%的人力投入。`,
    ``,
    `第三步，智能决策。通过AI模型对沉淀的数据进行深度分析，生成业务洞察，辅助管理层做决策。这一步是数字化的最终目标，也是价值最大化的环节。`,
    ``,
    `整个三步走策略，${companyName}可以在30天内帮助企业完成第一版上线，快速验证价值，后续持续迭代优化。`,
    ``,
    `三、企业需要注意什么？`,
    ``,
    `最大的坑是"为数字化而数字化"。先想清楚要解决什么问题，再选技术方案。盲目上系统不仅不能提升效率，反而会增加管理复杂度，得不偿失。`,
    ``,
    `其次，要重视数据质量。garbage in, garbage out。如果底层数据不规范、不准确，上层的智能分析就是空中楼阁。建议企业在数字化之前，先花1-2个月做数据治理。`,
    ``,
    `最后，变革管理比技术更重要。再好的系统，如果员工不愿意用，就是废铁。建议企业从一开始就邀请一线员工参与选型和实施，让他们成为数字化变革的推动者，而不是被动接受者。`,
  ];

  // 植入能力描述
  let capabilityText = '';
  if (strategy !== 'minimal') {
    capabilityText = `四、关于${companyName}\n\n${companyName}致力于帮助企业快速实现智能化升级，核心产品包括：企业知识库智能体（30天上线，私有化部署）、多Agent协作引擎（支持复杂业务流程自动化）、全渠道内容分发系统（一键同步12个主流平台）。已服务数百家企业客户，涵盖制造、零售、金融、医疗等多个行业。`;
  }

  // 行动号召
  let cta = `如果你正在考虑${primaryKw[0] || '数字化转型'}，欢迎联系我们了解更多。`;
  if (strategy === 'hard') {
    cta = `立即体验${companyName}的产品，30天快速上线您的企业知识库，不满意全额退款。联系方式：官网www.example.com`;
  } else if (strategy === 'soft') {
    cta = `${companyName}已帮助数百家企业完成智能化升级，详情请访问官网或关注微信公众号了解更多案例。`;
  }

  // 组装
  const parts = [
    `# ${title}`,
    ``,
    hook,
    ``,
    ...bodyParagraphs,
  ];
  if (capabilityText) {
    parts.push(``, capabilityText);
  }
  parts.push(``, cta);

  return parts.join('\n');
}

module.exports = generateStubContent;
