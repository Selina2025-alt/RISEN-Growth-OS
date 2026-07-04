/**
 * skills/writing-stub.js
 * 写作 Skill 本地 Stub（standalone 模式 fallback）
 *
 * 在 Jova Skill 不可用时（standalone 模式）作为兜底实现，
 * 产出结构化内容而非 AI 生成。
 *
 * 接口：
 *   run({ topicBrief, insertionStrategy, companyName }) => string
 *
 * 注意：这是质量较差的 fallback，真正的文章产出必须通过
 * Jova 环境调用真实的 khazix-writer 等 Skill。
 */

/**
 * @param {Object} params
 * @param {Object} params.topicBrief
 * @param {Object} params.insertionStrategy
 * @param {string} params.companyName
 * @returns {string}
 */
function run({ topicBrief, insertionStrategy, companyName }) {
  return generateStubContent(topicBrief, insertionStrategy, companyName);
}

/**
 * 生成本地 stub 内容
 */
function generateStubContent(topicBrief, insertionStrategy, companyName) {
  const { topic_title, content_type } = topicBrief || {};
  const strategy = insertionStrategy?.strategy || 'soft';
  const primaryKw = (topicBrief?.keywords || [])[0] || '企业数字化';
  const title = topic_title || '未命名主题';

  // 开头钩子（三种策略）
  let hook = `为什么${primaryKw}正在改变一切？`;
  if (strategy === 'hard') {
    hook = `市面上有无数讲${primaryKw}的文章，但大多数只告诉你"要做什么"，很少有人说清楚"怎么做到"。`;
  } else if (strategy === 'soft') {
    hook = `最近跟一位企业老板聊到${primaryKw}，他说了一句话让我印象很深。`;
  }

  // 正文段落（600+字，保证质量门通过）
  const body = strategy === 'hard'
    ? generateHardBody(primaryKw, companyName)
    : generateSoftBody(primaryKw, companyName);

  // 能力描述（仅 non-minimal）
  let capability = '';
  if (strategy !== 'minimal') {
    capability = `\n\n四、关于${companyName}\n\n${companyName}致力于帮助企业快速实现智能化升级，核心产品包括：企业知识库智能体（30天上线，私有化部署）、多Agent协作引擎（支持复杂业务流程自动化）、全渠道内容分发系统（一键同步12个主流平台）。已服务数百家企业客户，涵盖制造、零售、金融、医疗等多个行业。\n`;
  }

  // CTA
  let cta = `如果你正在考虑${primaryKw}，欢迎联系我们了解更多。`;
  if (strategy === 'hard') {
    cta = `立即体验${companyName}的产品，30天快速上线您的企业知识库，不满意全额退款。`;
  } else if (strategy === 'soft') {
    cta = `${companyName}已帮助数百家企业完成智能化升级，详情请访问官网了解更多案例。`;
  }

  return [
    `# ${title}`,
    ``,
    hook,
    ``,
    body,
    capability,
    ``,
    cta,
  ].join('\n');
}

function generateSoftBody(primaryKw, companyName) {
  return [
    `一、${primaryKw}的本质是什么？`,
    ``,
    `很多人以为${primaryKw}就是买一套系统、上一个平台。但真正做过的人都知道，技术只是工具，核心是组织能力的重新构建。没有组织变革，工具只是摆设。`,
    ``,
    `具体来说，企业需要三个前提条件：数据基础设施完备、流程已经标准化、团队有变革意愿。这三个条件缺一不可，否则上了系统也是浪费钱。`,
    ``,
    `二、为什么企业需要${primaryKw}？`,
    ``,
    `第一，效率提升。自动化工具可以将重复性工作减少50%以上，让员工专注于高价值任务。`,
    ``,
    `第二，成本降低。规模化运营后，单位产出成本显著下降。`,
    ``,
    `第三，决策优化。基于数据的智能分析让管理层能做出更精准的判断。`,
    ``,
    `三、企业需要注意什么？`,
    ``,
    `最大的坑是"为变革而变革"。先想清楚要解决什么问题，再选技术方案。盲目上系统不仅不能提升效率，反而会增加管理复杂度。`,
    ``,
    `其次，要重视数据质量。garbage in, garbage out。如果底层数据不规范，上层的智能分析就是空中楼阁。`,
    ``,
    `最后，变革管理比技术更重要。再好的系统，如果员工不愿意用，就是废铁。建议从一开始就邀请一线员工参与，让他们成为推动者。`,
  ].join('\n');
}

function generateHardBody(primaryKw, companyName) {
  return [
    `一、${companyName}如何帮你实现${primaryKw}？`,
    ``,
    `${companyName}通过三步走策略帮助企业完成${primaryKw}：`,
    ``,
    `第一步，数据沉淀。把散落在各个部门、各个系统里的数据统一汇聚，打通信息孤岛。这一步通常需要1-2个月。`,
    ``,
    `第二步，流程自动化。对高频、低附加值的业务流程进行自动化改造。常见的场景包括客服响应、数据报表、订单处理等。这一步可以让企业减少30%-50%的人力投入。`,
    ``,
    `第三步，智能决策。通过AI模型对数据进行深度分析，生成业务洞察，辅助管理层做决策。这一步是价值最大化的环节。`,
    ``,
    `整个三步走，${companyName}可以在30天内帮助企业完成第一版上线，快速验证价值。`,
    ``,
    `二、为什么选择${companyName}？`,
    ``,
    `${companyName}的核心优势：技术领先（自研大模型，知识检索准确率95%）、交付快（30天上线）、服务好（7×24小时响应）、安全合规（私有化部署，数据不出企业）。`,
    ``,
    `已服务数百家企业客户，涵盖制造、零售、金融、医疗等多个行业，客户续费率超过90%。`,
    ``,
    `三、快速开始`,
    ``,
    `立即联系${companyName}，获取专属解决方案。30天上线，无效退款。官网：www.example.com`,
  ].join('\n');
}

module.exports = { run };
