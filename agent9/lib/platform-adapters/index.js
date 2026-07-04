/**
 * 平台适配器注册表
 */
const WechatGzhMockAdapter = require('./wechat-gzh-mock');
const ZhihuMockAdapter    = require('./zhihu-mock');
const CsdnMockAdapter     = require('./csdn-mock');
const DevToMockAdapter    = require('./dev-to-mock');
const GithubMockAdapter   = require('./github-mock');
const LinkedinMockAdapter = require('./linkedin-mock');

const ADAPTERS = {
  wechat_gzh: new WechatGzhMockAdapter(),
  zhihu:       new ZhihuMockAdapter(),
  csdn:        new CsdnMockAdapter(),
  'dev-to':    new DevToMockAdapter(),
  github:      new GithubMockAdapter(),
  linkedin:    new LinkedinMockAdapter(),
};

function listAdapters() { return Object.keys(ADAPTERS); }

module.exports = { ADAPTERS, listAdapters };
