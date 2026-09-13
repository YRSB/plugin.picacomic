// 哔咔漫画（Picacomic）Rulia 插件
// 参考实现：RuliaReader/plugin.example、RuliaReader/package.types、venera-app/venera-configs/picacg.js

var DEFAULT_BASE_URL = 'https://picaapi.picacomic.com';
var API_KEY = 'C69BAF41DA5ABD1FFEDC6D2FEA56B';
// 接口签名密钥，与官方客户端保持一致
var API_SECRET = '~d}$Q7$eIni=V)9\\RK/P.RM4;9[7|@/CA}b~OW!3?EV`:<>M7pddUBL5n|0/*Cn';
var APP_VERSION = '2.2.1.3.3.4';
var APP_BUILD_VERSION = '45';
// 请求超时时间，避免网络卡住时 Rulia 一直转圈
var TIMEOUT_MS = 15000;

// 从插件设置读取手动 Token（唯一鉴权方式）

var CATEGORY_LIST = [
  '大家都在看',
  '大濕推薦',
  '那年今天',
  '官方都在看',
  '嗶咔漢化',
  '全彩',
  '長篇',
  '同人',
  '短篇',
  '圓神領域',
  '碧藍幻想',
  'CG雜圖',
  '英語 ENG',
  '生肉',
  '純愛',
  '百合花園',
  '耽美花園',
  '偽娘哲學',
  '後宮閃光',
  '扶他樂園',
  '單行本',
  '姐姐系',
  '妹妹系',
  'SM',
  '性轉換',
  '足の恋',
  '人妻',
  'NTR',
  '強暴',
  '非人類',
  '艦隊收藏',
  'Love Live',
  'SAO 刀劍神域',
  'Fate',
  '東方',
  'WEBTOON',
  '禁書目錄',
  '歐美',
  'Cosplay',
  '重口地帶'
];

// 字符串转 UTF-8 字节数组，避免依赖 TextEncoder
function utf8ToBytes(text) {
  var bytes = [];
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    // 处理代理对，支持 Emoji 等辅助平面字符
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      var next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        var point = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        bytes.push(0xf0 | (point >> 18));
        bytes.push(0x80 | ((point >> 12) & 0x3f));
        bytes.push(0x80 | ((point >> 6) & 0x3f));
        bytes.push(0x80 | (point & 0x3f));
        i++;
        continue;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6));
      bytes.push(0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12));
      bytes.push(0x80 | ((code >> 6) & 0x3f));
      bytes.push(0x80 | (code & 0x3f));
    } else {
      // 孤立代理项，用替换字符代替
      bytes.push(0xef);
      bytes.push(0xbf);
      bytes.push(0xbd);
    }
  }
  return bytes;
}

function bytesToHex(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var part = (bytes[i] >>> 0).toString(16);
    hex += part.length === 1 ? '0' + part : part;
  }
  return hex;
}

function rightRotate(value, bits) {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

// 纯 JS 的 SHA-256，用于接口签名，不依赖外部库
function sha256Bytes(messageBytes) {
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  var bitLen = messageBytes.length * 8;
  var padded = messageBytes.slice();
  padded.push(0x80);
  while ((padded.length % 64) !== 56) {
    padded.push(0x00);
  }
  // 追加 64 位大端长度，高 32 位在前
  var high = Math.floor(bitLen / 4294967296);
  var low = bitLen >>> 0;
  padded.push((high >>> 24) & 0xff);
  padded.push((high >>> 16) & 0xff);
  padded.push((high >>> 8) & 0xff);
  padded.push(high & 0xff);
  padded.push((low >>> 24) & 0xff);
  padded.push((low >>> 16) & 0xff);
  padded.push((low >>> 8) & 0xff);
  padded.push(low & 0xff);

  var w = new Array(64);
  for (var i = 0; i < padded.length; i += 64) {
    for (var t = 0; t < 16; t++) {
      w[t] = ((padded[i + t * 4] << 24) | (padded[i + t * 4 + 1] << 16) | (padded[i + t * 4 + 2] << 8) | padded[i + t * 4 + 3]) >>> 0;
    }
    for (var j = 16; j < 64; j++) {
      var s0 = (rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3)) >>> 0;
      var s1 = (rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10)) >>> 0;
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    var a = H[0];
    var b = H[1];
    var c = H[2];
    var d = H[3];
    var e = H[4];
    var f = H[5];
    var g = H[6];
    var h = H[7];
    for (var k = 0; k < 64; k++) {
      var S1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) >>> 0;
      var ch = ((e & f) ^ ((~e) & g)) >>> 0;
      var temp1 = (h + S1 + ch + K[k] + w[k]) >>> 0;
      var S0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) >>> 0;
      var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      var temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  var digest = [];
  for (var n = 0; n < H.length; n++) {
    digest.push((H[n] >>> 24) & 0xff);
    digest.push((H[n] >>> 16) & 0xff);
    digest.push((H[n] >>> 8) & 0xff);
    digest.push(H[n] & 0xff);
  }
  return digest;
}

// 标准 HMAC-SHA256，返回小写十六进制
function hmacSha256Hex(keyText, messageText) {
  var keyBytes = utf8ToBytes(keyText);
  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }
  while (keyBytes.length < 64) {
    keyBytes.push(0x00);
  }
  var oPad = [];
  var iPad = [];
  for (var i = 0; i < 64; i++) {
    oPad.push(keyBytes[i] ^ 0x5c);
    iPad.push(keyBytes[i] ^ 0x36);
  }
  var inner = sha256Bytes(iPad.concat(utf8ToBytes(messageText)));
  return bytesToHex(sha256Bytes(oPad.concat(inner)));
}

// 生成随机 UUID，用于签名 nonce
function createUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.floor(Math.random() * 16);
    var v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

// 按官方规则生成签名，path 需包含查询参数且不带前导斜杠
function createSignature(path, nonce, time, method) {
  var raw = path + time + nonce + method + API_KEY;
  return hmacSha256Hex(API_SECRET, raw.toLowerCase());
}

// 超时保护：Rulia 的请求若一直不返回，用超时先结算，避免界面无限转圈
function withTimeout(promise, ms, label) {
  var timeoutMs = ms || TIMEOUT_MS;
  var timer = null;
  var timeout = new Promise(function (resolve, reject) {
    timer = setTimeout(function () {
      reject(new Error((label || '请求') + '超时（' + timeoutMs + 'ms），请检查网络或更换 API 地址'));
    }, timeoutMs);
  });
  // 结算后清理计时器，避免残留定时器拖住进程
  return Promise.race([promise, timeout]).then(
    function (value) {
      if (timer) {
        clearTimeout(timer);
      }
      return value;
    },
    function (error) {
      if (timer) {
        clearTimeout(timer);
      }
      throw error;
    }
  );
}

// 安全打日志，部分旧版本可能没有 log 接口
function safeLog(level, message) {
  try {
    if (window.Rulia && window.Rulia.log) {
      window.Rulia.log(level, message);
    }
  } catch (e) {
    // 忽略日志异常
  }
}

function readUserConfig() {
  try {
    var config = window.Rulia.getUserConfig() || {};
    return config;
  } catch (e) {
    return {};
  }
}

function getBaseUrl() {
  var config = readUserConfig();
  var baseUrl = (config.baseUrl || DEFAULT_BASE_URL || '').toString().trim();
  if (!baseUrl) {
    baseUrl = DEFAULT_BASE_URL;
  }
  // 去掉末尾斜杠，避免拼接出双斜杠
  while (baseUrl.length > 1 && baseUrl.charAt(baseUrl.length - 1) === '/') {
    baseUrl = baseUrl.slice(0, -1);
  }
  return baseUrl;
}

function getAppChannel() {
  var config = readUserConfig();
  var channel = (config.appChannel || '3').toString().trim();
  if (channel !== '1' && channel !== '2' && channel !== '3') {
    return '3';
  }
  return channel;
}

// 手动配置的 Token，唯一的鉴权方式
function getConfiguredToken() {
  try {
    var config = window.Rulia.getUserConfig() || {};
    return ((config.token || '').toString()).trim();
  } catch (e) {
    return '';
  }
}

// 组装哔咔接口请求头
function buildHeaders(method, path, token) {
  var uuid = createUuid();
  var nonce = uuid.replace(/-/g, '');
  var time = Math.floor(Date.now() / 1000).toString();
  var signature = createSignature(path, nonce, time, method.toUpperCase());
  var headers = {
    'api-key': API_KEY,
    'accept': 'application/vnd.picacomic.com.v1+json',
    'app-channel': getAppChannel(),
    'authorization': token || '',
    'time': time,
    'nonce': nonce,
    'app-version': APP_VERSION,
    'app-uuid': 'defaultUuid',
    'image-quality': 'original',
    'app-platform': 'android',
    'app-build-version': APP_BUILD_VERSION,
    'user-agent': 'okhttp/3.8.1',
    'version': 'v1.5.4',
    'signature': signature,
    // 与 Venera 官方配置保持一致的客户端标记
    'http_client': 'dart:io'
  };
  if (method && method.toString().toUpperCase() === 'POST') {
    headers['Content-Type'] = 'application/json; charset=UTF-8';
  }
  return headers;
}

async function ensureToken() {
  var manual = getConfiguredToken();
  if (manual) {
    return manual;
  }
  throw new Error('请先在插件设置里填写 Token（获取办法见仓库 README）');
}

// 判断是否为鉴权失效，兼容 HTTP 异常文案与业务码
// 注意：插件自身的终止性报错不算过期，避免误报掩盖原文
function isAuthExpired(error, parsedBody) {
  if (parsedBody && (parsedBody.code === 401 || parsedBody.code === '401')) {
    return true;
  }
  if (!error) {
    return false;
  }
  var message = (error.message || error.toString() || '').toLowerCase();
  if (message.indexOf('请先在插件设置') !== -1 || message.indexOf('token 已失效') !== -1) {
    return false;
  }
  return message.indexOf('401') !== -1 || message.indexOf('unauthorized') !== -1 || message.indexOf('token') !== -1;
}

async function requestJson(method, path, bodyText) {
  var token = await ensureToken();
  var url = getBaseUrl() + '/' + path;
  var hasBody = (method === 'POST' && bodyText !== null && bodyText !== undefined);
  var headers = buildHeaders(method, path, token);
  if (!hasBody) {
    delete headers['Content-Type'];
  }
  var params = {
    url: url,
    method: method,
    timeout: TIMEOUT_MS,
    headers: headers
  };
  if (hasBody) {
    params.payload = bodyText || '{}';
    params.contentType = 'application/json';
  }
  safeLog('info', '发起请求：' + method + ' ' + path + '（contentType=' + (params.contentType || '无') + '）');
  try {
    var rawResponse = await withTimeout(window.Rulia.httpRequest(params), TIMEOUT_MS, method + ' ' + path);
    safeLog('info', '收到响应：' + method + ' ' + path + '（' + rawResponse.length + '字符）');
    var parsed = JSON.parse(rawResponse);
    if (parsed.code === 401 || parsed.code === '401') {
      throw new Error('Token 已失效，请更新插件设置中的 Token');
    }
    return parsed;
  } catch (error) {
    // 鉴权失效只报失效，不再重登（无账号登录）
    if (isAuthExpired(error, null)) {
      throw new Error('Token 已失效，请更新插件设置中的 Token');
    }
    throw error;
  }
}

async function apiGet(path) {
  return await requestJson('GET', path, '');
}

function buildFileUrl(file) {
  if (!file || !file.fileServer || !file.path) {
    return '';
  }
  var server = file.fileServer.toString();
  while (server.length > 1 && server.charAt(server.length - 1) === '/') {
    server = server.slice(0, -1);
  }
  var filePath = file.path.toString();
  if (filePath.charAt(0) !== '/') {
    filePath = '/' + filePath;
  }
  return server + '/static' + filePath;
}

// 统一漫画封面，兼容不同接口字段
function parseCover(comic) {
  if (comic && comic.thumb) {
    var cover = buildFileUrl(comic.thumb);
    if (cover) {
      return cover;
    }
  }
  return (comic && (comic.cover || comic.coverUrl)) || '';
}

// 统一列表项，Rulia 需要 title、url、coverUrl
// 为兼容读取 cover 字段的旧版本，同时返回 cover
function toMangaItem(comic) {
  var id = comic._id || comic.id;
  var cover = parseCover(comic);
  return {
    title: comic.title || '未知标题',
    url: 'https://picaapi.picacomic.com/comics/' + id,
    coverUrl: cover,
    cover: cover
  };
}

function toMangaList(comics) {
  var result = [];
  for (var i = 0; i < comics.length; i++) {
    if (comics[i] && (comics[i]._id || comics[i].id)) {
      result.push(toMangaItem(comics[i]));
    }
  }
  safeLog('info', '解析到 ' + result.length + ' 条漫画');
  return result;
}

// 从 Rulia 传入的漫画 URL 中解析漫画 ID
function parseComicId(comicUrl) {
  var text = (comicUrl || '').toString();
  var match = text.match(/comics\/([^/?#]+)/) || text.match(/comic\/([^/?#]+)/) || text.match(/picacomic:([^/?#]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return text;
}

// 从章节 URL 中解析漫画 ID 与章节序号
function parseChapterUrl(chapterUrl) {
  var text = (chapterUrl || '').toString();
  var match = text.match(/comics\/([^/]+)\/order\/([^/?#]+)/);
  if (match) {
    return { comicId: match[1], order: match[2] };
  }
  return { comicId: parseComicId(text), order: text };
}

function parseFilterOptions(rawFilterOptions) {
  if (!rawFilterOptions) {
    return {};
  }
  try {
    if (typeof rawFilterOptions === 'string') {
      return JSON.parse(rawFilterOptions) || {};
    }
    return rawFilterOptions || {};
  } catch (e) {
    return {};
  }
}

async function setMangaListFilterOptions() {
  try {
    safeLog('info', '开始加载筛选器');
    var categoryOptions = [{ label: '全部', value: '' }];
    for (var i = 0; i < CATEGORY_LIST.length; i++) {
      categoryOptions.push({ label: CATEGORY_LIST[i], value: CATEGORY_LIST[i] });
    }
    var result = [
      {
        label: '浏览',
        name: 'mode',
        options: [
          { label: '最新', value: 'latest' },
          { label: '随机', value: 'random' },
          { label: '日榜', value: 'H24' },
          { label: '周榜', value: 'D7' },
          { label: '月榜', value: 'D30' }
        ]
      },
      {
        label: '分类',
        name: 'category',
        options: categoryOptions
      },
      {
        label: '排序',
        name: 'sort',
        options: [
          { label: '新到旧', value: 'dd' },
          { label: '旧到新', value: 'da' },
          { label: '最多喜欢', value: 'ld' },
          { label: '最多指名', value: 'vd' }
        ]
      }
    ];
    window.Rulia.endWithResult(result);
  } catch (error) {
    // 筛选器必须结算，否则列表页会一直转圈，降级为最小筛选器
    safeLog('error', '加载筛选器失败：' + ((error && error.message) || error.toString()));
    window.Rulia.endWithResult([
      { label: '浏览', name: 'mode', options: [{ label: '最新', value: 'latest' }] },
      { label: '分类', name: 'category', options: [{ label: '全部', value: '' }] },
      { label: '排序', name: 'sort', options: [{ label: '新到旧', value: 'dd' }] }
    ]);
  }
}

async function getMangaListBySearch(page, keyword, sort) {
  var path = 'comics/advanced-search?page=' + page + '&keyword=' + encodeURIComponent(keyword) + '&sort=' + (sort || 'dd');
  var response = await requestJson('POST', path, null);
  // 搜索失败直接抛服务端原文，避免静默空列表无法定位
  if (response && response.code !== undefined && response.code !== 200 && response.code !== '200') {
    throw new Error('搜索失败：' + (response.message || ('code=' + response.code)));
  }
  var docs = (((response || {}).data || {}).comics || {}).docs || [];
  window.Rulia.endWithResult({ list: toMangaList(docs) });
}

async function getMangaListByCategory(page, category, sort) {
  var path = 'comics?page=' + page + '&c=' + encodeURIComponent(category) + '&s=' + (sort || 'dd');
  var response = await apiGet(path);
  var docs = (((response || {}).data || {}).comics || {}).docs || [];
  window.Rulia.endWithResult({ list: toMangaList(docs) });
}

async function getMangaListByLatest(page, sort) {
  var path = 'comics?page=' + page + '&s=' + (sort || 'dd');
  var response = await apiGet(path);
  var docs = (((response || {}).data || {}).comics || {}).docs || [];
  window.Rulia.endWithResult({ list: toMangaList(docs) });
}

async function getMangaListByLeaderboard(mode) {
  var path = 'comics/leaderboard?tt=' + mode + '&ct=VC';
  var response = await apiGet(path);
  var comics = ((response || {}).data || {}).comics || [];
  window.Rulia.endWithResult({ list: toMangaList(comics) });
}

async function getMangaListByRandom(page) {
  // 随机接口不分页，第 2 页起返回空，避免无限加载
  if (page > 1) {
    window.Rulia.endWithResult({ list: [] });
    return;
  }
  var response = await apiGet('comics/random');
  var comics = ((response || {}).data || {}).comics || [];
  window.Rulia.endWithResult({ list: toMangaList(comics) });
}

async function getMangaList(page, pageSize, keyword, rawFilterOptions) {
  try {
    safeLog('info', '开始加载漫画列表，第 ' + page + ' 页');
    var currentPage = parseInt(page, 10);
    if (!currentPage || currentPage < 1) {
      currentPage = 1;
    }
    var filters = parseFilterOptions(rawFilterOptions);
    var sort = filters.sort || 'dd';
    var text = (keyword || '').toString().trim();
    try {
      safeLog('info', 'Rulia版本：' + window.Rulia.getAppVersion() + '，走' + (text ? '搜索' : '列表') + '接口，排序=' + sort);
    } catch (e) {
    }
    if (text) {
      await getMangaListBySearch(currentPage, text, sort);
      return;
    }

    var category = (filters.category || '').toString();
    var mode = (filters.mode || 'latest').toString();
    if (category) {
      await getMangaListByCategory(currentPage, category, sort);
      return;
    }
    if (mode === 'random') {
      await getMangaListByRandom(currentPage);
      return;
    }
    if (mode === 'H24' || mode === 'D7' || mode === 'D30') {
      await getMangaListByLeaderboard(mode);
      return;
    }
    await getMangaListByLatest(currentPage, sort);
  } catch (error) {
    var listError = (error && error.message) || error.toString();
    safeLog('error', '加载漫画列表失败：' + listError);
    window.Rulia.endWithException(listError);
  }
}

async function loadAllEpisodes(comicId) {
  var all = [];
  var currentPage = 1;
  while (true) {
    var response = await apiGet('comics/' + comicId + '/eps?page=' + currentPage);
    var eps = ((response || {}).data || {}).eps || {};
    var docs = eps.docs || [];
    for (var i = 0; i < docs.length; i++) {
      all.push(docs[i]);
    }
    var totalPages = eps.pages || 1;
    if (currentPage >= totalPages || docs.length === 0) {
      break;
    }
    currentPage++;
  }
  // 按官方 order 排序，保证章节顺序稳定
  all.sort(function (a, b) {
    return (a.order || 0) - (b.order || 0);
  });
  return all;
}

async function getMangaData(comicUrl) {
  try {
    var comicId = parseComicId(comicUrl);
    var infoResponse = await apiGet('comics/' + comicId);
    var info = ((infoResponse || {}).data || {}).comic || {};
    var episodes = await loadAllEpisodes(comicId);

    var chapterList = [];
    for (var i = 0; i < episodes.length; i++) {
      var order = (i + 1).toString();
      chapterList.push({
        title: episodes[i].title || ('第 ' + order + ' 话'),
        url: 'https://picaapi.picacomic.com/comics/' + comicId + '/order/' + order
      });
    }

    var metaLines = [];
    if (info.author) {
      metaLines.push('作者：' + info.author);
    }
    if (info.chineseTeam) {
      metaLines.push('汉化组：' + info.chineseTeam);
    }
    if (info.categories && info.categories.length) {
      metaLines.push('分类：' + info.categories.join('、'));
    }
    if (info.tags && info.tags.length) {
      metaLines.push('标签：' + info.tags.join('、'));
    }
    var likes = info.totalLikes || info.likesCount;
    if (likes !== undefined && likes !== null) {
      metaLines.push('喜欢：' + likes);
    }
    if (info.pagesCount) {
      metaLines.push('总页数：' + info.pagesCount);
    }
    if (info.updated_at) {
      metaLines.push('更新：' + info.updated_at.slice(0, 10));
    }
    if (info.description) {
      metaLines.push('');
      metaLines.push(info.description);
    }

    window.Rulia.endWithResult({
      title: info.title || '未知标题',
      description: metaLines.join('\n') || '暂无简介',
      coverUrl: parseCover(info),
      chapterList: chapterList
    });
  } catch (error) {
    var detailError = (error && error.message) || error.toString();
    safeLog('error', '加载漫画详情失败：' + detailError);
    window.Rulia.endWithException(detailError);
  }
}

async function getChapterImageList(chapterUrl) {
  try {
    var parsed = parseChapterUrl(chapterUrl);
    var images = [];
    var currentPage = 1;
    while (true) {
      var path = 'comics/' + parsed.comicId + '/order/' + parsed.order + '/pages?page=' + currentPage;
      var response = await apiGet(path);
      var pages = ((response || {}).data || {}).pages || {};
      var docs = pages.docs || [];
      for (var i = 0; i < docs.length; i++) {
        var imageUrl = buildFileUrl(docs[i] && docs[i].media);
        if (imageUrl) {
          // 接口不返回宽高，先用占位，阅读器会按实际图片渲染
          images.push({ url: imageUrl, width: 1, height: 1 });
        }
      }
      var totalPages = pages.pages || 1;
      if (currentPage >= totalPages || docs.length === 0) {
        break;
      }
      currentPage++;
    }
    window.Rulia.endWithResult(images);
  } catch (error) {
    var imageError = (error && error.message) || error.toString();
    safeLog('error', '加载章节图片失败：' + imageError);
    window.Rulia.endWithException(imageError);
  }
}

async function getImageUrl(imageUrl) {
  // 图片地址回传兼容两种约定：部分版本等待 endWithResult，模板写法直接 return
  // 先尝试 endWithResult，失败则降级，最终都直接返回
  try {
    if (window.Rulia && window.Rulia.endWithResult) {
      window.Rulia.endWithResult(imageUrl);
    }
  } catch (e) {
    // 忽略，降级为直接返回
  }
  return imageUrl;
}
