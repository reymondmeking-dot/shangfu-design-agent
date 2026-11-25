import { sourceContextFor } from "./source-cases.mjs";

export const catalogVersion = "shangfu-sim-2";

const privateScene = ["private"];
const groupScene = ["group"];
const allScenes = ["private", "group"];
const collarNames = {
  cross: "交领开襟", "low-stand": "低立领", stand: "立领",
  lapel: "西装翻驳领", shawl: "青果领", round: "圆领", unknown: "领型待核",
};
const careNames = { machine: "可机洗", dry: "干洗", hand: "手洗", unknown: "护理方式待核" };

function asset(type, id, name, scenes, tags, description, limits, properties = {}) {
  return { id, type, name, scenes, tags, description, limits, simulated: true, ...properties };
}

export const catalog = [
  asset("pattern", "PAT-001", "H 型微落肩交领外套", privateScene, ["新中式", "简约", "正式", "直身", "抬臂", "宽肩背", "交领"], "微落平肩、直身无收腰，交领开襟，肩背和袖管留出活动空间。", ["门襟尺寸以版师确认的基版为准", "需试穿核对肩袖活动"], { collar: "cross", mobility: true, rank: 12 }),
  asset("pattern", "PAT-002", "H 型低立领宽松外套", privateScene, ["新中式", "简约", "正式", "直身", "抬臂", "宽肩背", "低立领"], "低立领、圆润领口，配合微落肩和直身轮廓。", ["领高与颈围需量体", "门襟和领口组合需复核"], { collar: "low-stand", mobility: true, rank: 9 }),
  asset("pattern", "PAT-003", "旧样衣档案外套", privateScene, ["正式", "直身", "宽松"], "仅保留轮廓说明与版房档案记录。", ["没有领型记录", "袖窿活动量未核验"], { collar: "unknown", mobility: null, rank: 0 }),
  asset("pattern", "PAT-004", "礼宾翻驳领活动夹克", groupScene, ["商务", "正式", "机洗", "活动", "抬臂", "礼宾", "直身"], "翻驳领、活动袖窿、直身夹克，适合站姿接待与搬运行李。", ["各尺码须试穿确认", "夹克护理方式需与面料、工艺一同核对"], { collar: "lapel", mobility: true, rank: 12 }),
  asset("pattern", "PAT-005", "挺身立领礼仪外套", allScenes, ["正式", "挺括", "礼宾", "立领"], "轮廓挺括，立领形成清晰的礼仪视觉。", ["活动量有限", "领高需复核"], { collar: "stand", mobility: false, rank: 4 }),
  asset("pattern", "PAT-006", "低立领礼宾制服夹克", groupScene, ["商务", "礼宾", "低立领", "抬臂", "活动", "直身"], "低立领、直身外壳与活动袖窿，适合简洁的职业形象。", ["团体版放码由版师确认"], { collar: "low-stand", mobility: true, rank: 9 }),
  asset("pattern", "PAT-007", "圆领宽松中式外套", privateScene, ["新中式", "休闲", "宽松", "圆领", "抬臂"], "圆领、直落肩线，袖管留量较宽。", ["不带交领结构"], { collar: "round", mobility: true, rank: 3 }),
  asset("pattern", "PAT-008", "修身双排扣西装", allScenes, ["商务", "修身", "正式", "翻领"], "带腰部塑形的双排扣西装轮廓。", ["需严格核对肩背与腰部余量", "不作为高活动岗位首选"], { collar: "lapel", mobility: false, rank: 4 }),

  asset("fabric", "FAB-001", "真丝暗纹织花", privateScene, ["新中式", "简约", "正式", "真丝", "暗纹", "垂感"], "低对比织花，垂感适中，适合正式海派外套。", ["仅模拟资料", "护理按样布和工艺核实"], { care: "dry", weightClass: "medium", rank: 12 }),
  asset("fabric", "FAB-002", "宋锦细暗纹织物", privateScene, ["真丝", "宋锦", "暗纹", "正式", "新中式", "挺括"], "细密织纹，适用于见客或节庆正式穿着。", ["实际成分待样布核对", "局部叠层需试样"], { care: "dry", weightClass: "medium", rank: 8 }),
  asset("fabric", "FAB-003", "藏蓝易护理斜纹混纺", groupScene, ["机洗", "藏蓝", "商务", "礼宾", "耐磨", "哑光"], "模拟护理卡标记可机洗的深藏蓝斜纹，适合团队职业服。", ["洗后牢度和批次色差待核", "成衣护理以样衣测试为准"], { care: "machine", colors: ["深藏蓝", "藏蓝", "深蓝"], weightClass: "medium", rank: 13 }),
  asset("fabric", "FAB-004", "深蓝精纺羊毛", allScenes, ["羊毛", "藏蓝", "商务", "正式", "垂感"], "精纺细面，深蓝偏灰，适合正式交流。", ["模拟护理卡要求干洗", "需复核深蓝与藏蓝色差"], { care: "dry", colors: ["深蓝"], weightClass: "medium", rank: 8 }),
  asset("fabric", "FAB-005", "深藏蓝抗皱棉混纺", allScenes, ["机洗", "藏蓝", "抗皱", "棉", "商务"], "棉混纺斜纹，模拟护理卡允许温和机洗。", ["建议核对缩水率和摩擦牢度"], { care: "machine", colors: ["深藏蓝", "藏蓝", "深蓝"], weightClass: "medium", rank: 9 }),
  asset("fabric", "FAB-006", "哑光香云纱", privateScene, ["新中式", "哑光", "肌理", "香云纱", "正式"], "表面肌理自然，有低调的哑光效果。", ["样布实际颜色、垂感与护理须确认"], { care: "hand", weightClass: "light", rank: 7 }),
  asset("fabric", "FAB-007", "柔光缎面", allScenes, ["演出", "光泽", "垂感", "柔软", "缎面"], "柔光表面适合镜头表现和活动视觉。", ["机洗和色牢度暂无模拟证据"], { care: "unknown", weightClass: "light", rank: 4 }),
  asset("fabric", "FAB-008", "深灰职业服鸟眼织纹", groupScene, ["机洗", "深灰", "商务", "耐磨", "职业服"], "细小鸟眼纹，深灰职业布面。", ["款式、辅料和洗涤测试待核"], { care: "machine", colors: ["深灰", "灰色"], weightClass: "medium", rank: 7 }),

  asset("craft", "TEC-001", "隐式门襟收束", privateScene, ["新中式", "简约", "交领", "暗扣", "不外露纽扣"], "收束结构藏在门襟，保留简洁的衣身正面。", ["适用交领、低立领与立领", "暗扣位置由版师确认"], { collars: ["cross", "low-stand", "stand"], weightClasses: ["light", "medium"], rank: 12 }),
  asset("craft", "TEC-002", "手工一字盘扣", privateScene, ["新中式", "传统工艺", "盘扣", "立领"], "一字盘扣，可作为新中式可视细节。", ["体积和扣位需确认", "属于外露装饰"], { collars: ["cross", "low-stand", "stand"], rank: 7 }),
  asset("craft", "TEC-003", "撞色滚边", allScenes, ["撞色", "滚边", "演出", "新中式"], "领口、门襟或袖口可使用窄幅撞色滚边。", ["样布先核对颜色与起皱"], { rank: 4 }),
  asset("craft", "TEC-004", "耐用部位加固", groupScene, ["礼宾", "耐用", "机洗", "加固", "商务"], "在口袋和高使用频率部位布置低可见度加固。", ["成衣强度与护理需样衣测试"], { rank: 12 }),
  asset("craft", "TEC-005", "低对比机绣标识", groupScene, ["标识", "机洗", "商务", "职业服"], "可选同色标识，尽量减少礼宾服视觉干扰。", ["图标版权、绣线与测试需审核"], { rank: 6 }),
  asset("craft", "TEC-006", "翻领细节压线", allScenes, ["正式", "商务", "翻领", "压线"], "翻领边缘可用低对比压线突出结构。", ["只能与翻驳领组合"], { collars: ["lapel"], rank: 7 }),
  asset("craft", "TEC-007", "腋下活动结构", allScenes, ["抬臂", "活动", "宽肩背"], "使用简洁活动结构辅助高频抬臂动作。", ["需要可抬臂版型", "整体活动范围需试穿"], { mobility: true, rank: 6 }),
  asset("craft", "TEC-008", "轻薄织物手工收边", privateScene, ["真丝", "暗纹", "柔软", "收边"], "轻薄织物边缘保留低厚度收边。", ["适用于轻薄面料"], { weightClasses: ["light"], rank: 5 }),
  asset("craft", "TEC-009", "无扣开襟与一体式贴边", privateScene, ["无扣开襟", "无外露纽扣", "一体式贴边", "直筒袖口", "侧衩挡布"], "前中略掩合，无扣件。前门襟连做贴边，直筒袖口内设贴边，两侧下摆开衩并设挡布。", ["模拟结构需样衣验证", "贴边宽、衩高与松量由版师复核"], { collars: ["cross", "low-stand"], weightClasses: ["light", "medium"], rank: 1 }),

  asset("case", "CAS-001", "正式新中式外套", privateScene, ["新中式", "正式", "低立领", "宽松"], "模拟回顾低领高与腹部松量的沟通经验。", ["设计参考，需按新客重新确认"], { rank: 7 }),
  asset("case", "CAS-002", "植物暗纹正式外套", privateScene, ["新中式", "正式", "暗纹", "宋锦"], "模拟回顾暗纹织物与内搭使用情境。", ["仅作风格参考"], { rank: 7 }),
  asset("case", "CAS-003", "户外坐奏演出套装", privateScene, ["演出", "活动", "抬臂", "撞色"], "模拟回顾坐奏、抬臂与上镜效果的试穿检查。", ["演出条件与工艺由业务人员确认"], { rank: 4 }),
  asset("case", "CAS-004", "酒店礼宾活动夹克", groupScene, ["礼宾", "机洗", "藏蓝", "商务", "活动", "抬臂"], "模拟职业服案例，兼顾迎宾与搬运行李。", ["需复核批次色差和各尺码活动性"], { rank: 13 }),
  asset("case", "CAS-005", "前台接待职业服", groupScene, ["职业服", "正式", "商务", "耐用"], "模拟案例，回顾常态护理和衣着识别。", ["补货条件需再确认"], { rank: 7 }),
  asset("case", "CAS-006", "宽肩背新中式外套", privateScene, ["新中式", "正式", "简约", "宽肩背", "抬臂", "交领"], "模拟结构记录，关注抬臂时的肩背松量与袖管活动范围。", ["只复用抬臂验证与结构经验", "不带出任何私人体型勘测值"], { rank: 13 }),
];

export { demoCases } from './demo-cases.mjs';

const definitions = [
  ["style", "风格调性"], ["silhouette", "廓形要求"], ["fabric", "面料质感"],
  ["craft", "工艺细节"], ["color", "色彩体系"], ["scene", "场景适配度"],
  ["collar", "领型"], ["care", "护理要求"], ["activity", "活动要求"],
];
const groupDefinitions = [
  ["headcount", "人数规模"], ["wearers", "穿着人群与岗位"], ["replenishment", "补货安排"],
];
const fitDefinitions = [
  ["placketWidthRequest", "门襟宽度目标", /门襟\s*(?:的\s*)?(?:宽度|宽)/],
  ["garmentLengthRequest", "衣长目标", /(?:成衣\s*)?衣长|衣身长|后中长/],
  ["shoulderWidthRequest", "肩宽目标", /(?:成衣\s*)?肩宽/],
  ["sleeveLengthRequest", "袖长目标", /袖长|袖子长/],
  ["collarWidthRequest", "领宽目标", /领宽|领口宽度/],
  ["collarHeightRequest", "领高目标", /领高|领子高度/],
  ["garmentChestRequest", "成衣胸围目标", /成衣\s*胸围/],
  ["chestRequest", "胸围量体参考", /(?<!成衣)(?:净体|净)?胸围/],
  ["waistRequest", "腰围量体参考", /(?:净体|净)?腰围/],
  ["heightRequest", "身高参考", /身高/],
];
const designDefinitions = [["designDetail","纹样与地域偏好"],["garmentScope","本单交付品类"],["bodyDescription","体型原话"]];
const definitionByKey = Object.fromEntries([...definitions, ...groupDefinitions, ...fitDefinitions, ...designDefinitions]);
const fitKeys = new Set(fitDefinitions.map(([key]) => key));

const vocab = {
  style: [
    ["新中式", /新中式|中式|海派|东方感|国风/], ["简约利落", /简约|简洁|利落|干净|大方|大气|低调|克制/],
    ["商务", /商务|通勤|职场/], ["正式", /正式|庄重/], ["优雅", /优雅|端庄|得体|有气质/], ["休闲", /休闲|松弛/],
    ["古典", /古典|复古|传统/], ["活力", /明快|活力|上镜/],
  ],
  silhouette: [
    ["直身 H 型", /直身|[hH]\s*[型形]/], ["宽松舒展", /宽松|不贴身|不要太紧|不要束缚|别卡|不卡手臂/],
    ["肩背留量", /宽肩|肩背.{0,4}宽|不压肩|不要压肩|肩部舒展/], ["修身轮廓", /修身|收腰|合体/],
  ],
  fabric: [
    ["真丝", /真丝|桑蚕丝|丝绸/], ["细暗纹", /暗纹|暗花/], ["宋锦", /宋锦/], ["香云纱", /香云纱/],
    ["纯羊毛", /纯羊毛|全羊毛|100\s*[%％]\s*羊毛/], ["羊毛", /羊毛|毛料/], ["棉混纺", /棉混纺/], ["棉", /棉纤维|棉料|棉质|棉布|棉/],
    ["亚麻", /亚麻/], ["羊绒", /羊绒/], ["皮革", /皮革|牛皮|羊皮/], ["有垂感", /垂感|垂坠/],
    ["轻薄透气", /轻薄|透气/], ["柔软", /柔软|手感柔和/], ["哑光", /哑光|低光泽/],
    ["肌理", /肌理|纹理/], ["有质感", /质感|手感/], ["耐用易护理", /耐用|耐磨|耐洗|机洗|抗皱/],
  ],
  craft: [
    ["无扣开襟", /无扣(?:件|开襟)?|不(?:设|装)(?:任何)?扣件|不要任何(?:纽扣|扣子|扣件)/], ["一体式贴边", /一体式贴边/],
    ["隐式门襟", /隐.{0,3}(?:门襟|扣)|暗扣/], ["无外露纽扣", /无外露纽扣|纽扣不外露|不外露纽扣|不要(?:外露的?纽扣|明扣)/],
    ["手工盘扣", /手工(?:一字)?盘扣/], ["盘扣", /盘扣/], ["滚边", /滚边|包边/], ["压线", /压线|明线/], ["撞色", /撞色/],
    ["暗花", /暗花|暗纹/], ["机绣标识", /机绣标识|机绣/], ["绣标", /绣标|刺绣|标识/],
    ["活动结构", /活动袖窿|活动结构|腋下放量/], ["加固", /加固|打枣/], ["手工收边", /手工收边/],
  ],
  color: [
    ["深藏蓝", /深藏蓝|藏青|海军蓝|藏蓝|海军色/], ["深蓝", /深蓝/], ["深灰", /深灰/],
    ["灰色", /灰色|浅灰/], ["墨绿", /墨绿|深绿/], ["黑色", /黑色|纯黑|墨黑/],
    ["米白", /米白|象牙白|奶白/], ["白色", /白色|纯白/], ["酒红", /酒红|枣红|暗红/],
    ["红色", /红色/], ["蓝色", /蓝色/], ["粉色", /粉色|亮粉|玫粉/], ["撞色", /撞色/],
    ["冷灰蓝", /冷灰蓝/], ["暖杏色", /暖杏色|暖杏/], ["驼色", /驼色/], ["咖啡色", /咖啡色/],
    ["卡其色", /卡其色|卡其/], ["炭灰", /炭灰/], ["蓝灰", /蓝灰/], ["雾紫灰", /雾紫灰/],
    ["紫色", /紫色/], ["浅紫", /浅紫/], ["砖红", /砖红/], ["朱砂红", /朱砂红/], ["深棕色", /深棕色|深棕/],
  ],
  scene: [
    ["正式场合", /正式|典礼|宴会|颁奖|重要场合/], ["办公室商务", /办公室|通勤|办公场景|职场穿着/],
    ["室内接待", /室内(?:[^，。；、！？]{0,4})接待/], ["室外迎宾", /(?:室外|户外)(?:[^，。；、！？]{0,4})迎宾/],
    ["酒店礼宾", /礼宾|酒店迎宾|迎宾|接待|前台/], ["户外使用", /户外|室外/], ["演出上镜", /舞台|上镜|演出|演奏/],
    ["日常休闲", /日常(?:休闲|生活|出游|穿着|穿搭|穿)|休闲|旅行/],
  ],
  activity: [
    ["抬臂舒展", /抬臂|抬手|不卡手臂|压肩|搬运行李|搬行李|肩部舒展/],
    ["搬运行李", /搬运行李|搬行李/], ["久站活动", /站立|久站|迎宾|接待/], ["坐姿舒适", /久坐|坐奏|坐姿/], ["腰腹宽松", /腰腹|腹部|肚腩/],
  ],
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeScene(value) {
  return /group|团体|团服|职业服|酒店|礼宾/i.test(cleanText(value)) ? "group" : "private";
}

function inferScene(scene, text) {
  if (cleanText(scene)) return normalizeScene(scene);
  return /团队|团体|职业服|制服|礼宾|岗位|批量|[0-9]+\s*人/.test(text) ? "group" : "private";
}

// A list stays under the same modifier until the customer starts a new one.
// “必须商务、正式” shares a requirement; “希望商务、统一藏蓝” starts a separate colour condition.
const modifierBoundary = /(?:、|并且|但是|同时|但|并|以及|和|及|且)(?=\s*(?:(?:风格|颜色|配色|色彩|廓形|面料|工艺|领型|护理方式)\s*)?(?:希望|想要|喜欢|偏好|最好|倾向|优先|必须|务必|一定要|指定|限定|统一|只(?:能|可|用|要)|需要|要求|禁止|不能|不要|无需|不要求))/u;
const clauseBreak = new RegExp("[，。；！？，,;!?\n]|"+modifierBoundary.source,"u");
const segmentBoundary = new RegExp(clauseBreak.source+"|(?<!\\d)\\.|\\.(?!\\d)","gu");

function segmentFor(text, start) {
  let left = 0;
  for (const match of text.matchAll(segmentBoundary)) {
    if (match.index >= start) return text.slice(left, match.index).trim();
    left = match.index + match[0].length;
  }
  return text.slice(left).trim();
}

function isNegated(text, index) {
  const previous = text.slice(Math.max(0, index - 12), index);
  return /(?:不要|不想要|不接受|不能用|不选|不做|不用|拒绝|避免|别用|不能|不可|不可以|不允许|不建议|禁止)\s*(?:穿|做|使用|用|采用|选择|选|再)?\s*(?:过度|太|过于)?\s*$/.test(previous);
}

function isWaived(text, index) {
  return /(?:不要求|不需要|不必|无需|不强制|未限定|无须|不一定要)(?:可)?\s*$/.test(text.slice(Math.max(0, index - 12), index));
}

const inheritedExclusion = /(?:不要|不用|别用|避免|禁止|不能用|不能使用|拒绝)(?:使用|选择|用)?[^，。；！？]{0,22}(?:以及|与|和|或|、)\s*$/;
const inheritedExclusionKeys = new Set(["fabric", "craft", "color"]);
const scopedOverrides = /改用|改为|而用|而要|但必须|但只用/;

function isExplicit(segment) {
  const strong = segment.replace(/不(?:一定要|需要|要求|强制|必)|并非必须|不是必须|无需/g, "");
  return /必须|一定要|只(?:能|要|可)|仅可|务必|明确要|需要|要求|限定|不能|不可|禁止|指定|统一|不要/.test(strong);
}

function defineField(key, value, level, source, evidence = "", extra = {}) {
  const label = definitionByKey[key] ?? key;
  return { key, label, value, level, source, evidence, ...extra };
}

function detectVocabulary(text, key, includeNegated = false) {
  const matches = [];
  for (const [value, expression] of vocab[key] ?? []) {
    for (const match of text.matchAll(new RegExp(expression.source, "g"))) {
      if (isWaived(text, match.index)) continue;
      const leading = text.slice(Math.max(0, match.index - 32), match.index).split(clauseBreak).at(-1);
      const joinedExclusion = inheritedExclusionKeys.has(key) && !scopedOverrides.test(leading) && inheritedExclusion.test(leading);
      const negated = (isNegated(text, match.index) || joinedExclusion) && !(key === "activity" && match[0] === "压肩");
      matches.push({ value, quote: match[0], clause: segmentFor(text, match.index), negated, index: match.index });
    }
  }
  return matches.filter(item => (includeNegated || !item.negated) && !matches.some(other =>
    key === "color" && other.quote.length > item.quote.length && other.index < item.index + item.quote.length && item.index < other.index + other.quote.length ||
    other.quote.length > item.quote.length && other.index <= item.index &&
    other.index + other.quote.length >= item.index + item.quote.length && (
      key === "fabric" && (item.value === "羊毛" && other.value === "纯羊毛" || item.value === "棉" && other.value === "棉混纺") ||
      key === "craft" && item.value === "盘扣" && other.value === "手工盘扣" ||
      key === "craft" && item.value === "绣标" && other.value === "机绣标识"
    )
  ));
}

const collarExpression = /低立领|低立式领|矮立领|高立领|中式立领|立领|交领|斜襟领|斜领|青果(?:西装)?领|翻驳领|西装领|翻领|小圆领|圆领/g;
const careExpression = /(?:水洗机洗|洗衣机洗|放洗衣机洗|机洗|干洗|手洗)/g;

function collarCode(value) {
  const match = cleanText(value).toLowerCase();
  if (/^low[-_ ]?stand$|低立|矮立/.test(match)) return "low-stand";
  if (/^cross$|交领|斜襟领|斜领/.test(match)) return "cross";
  if (/^shawl$|青果(?:西装)?领/.test(match)) return "shawl";
  if (/^lapel$|驳领|翻领|西装领/.test(match)) return "lapel";
  if (/^round$|圆领/.test(match)) return "round";
  if (/^stand$|立领/.test(match)) return "stand";
  return "unknown";
}

function careCode(value) {
  const match = cleanText(value).toLowerCase();
  if (/^machine$|机洗|洗衣机/.test(match)) return "machine";
  if (/^dry$|干洗/.test(match)) return "dry";
  if (/^hand$|手洗/.test(match)) return "hand";
  return "unknown";
}

function detectChoice({ key, text, expression, code, names, defaultText }) {
  const matches = [...text.matchAll(expression)].map(match => ({
    value: code(match[0]),
    quote: match[0],
    clause: segmentFor(text, match.index),
    negated: isNegated(text, match.index) || /(?:无|没有|别做|别选|不带|(?:不能|不可|不要)(?:以|拿|用)(?:普通|其他|其它)?)\s*$/.test(text.slice(Math.max(0,match.index-10),match.index)),
    waived: isWaived(text, match.index),
  })).filter(match => match.value !== "unknown" && !match.waived);
  const positive = matches.filter(match => !match.negated);
  const excluded = [...new Set(matches.filter(match => match.negated).flatMap(match =>
    key === "collar" && /^(?:中式)?立领$/.test(match.quote) ? ["stand","low-stand"] : [match.value]))];
  if (!positive.length) {
    if (excluded.length) {
      const negative = matches.find(match => match.negated);
      return defineField(key, excluded.map(value => "避免" + names[value]).join("、"), "required", "customer", negative.clause, { excluded });
    }
    return defineField(key, defaultText ?? "", "unspecified", defaultText ? "agent" : "pending");
  }
  const explicitChanges = positive.filter(match => /改为|改用|改成|换为|换用|换成|最终(?:必须|选择|选|确定|确认|采用|要)|确定选/.test(match.clause));
  const active = explicitChanges.length ? [explicitChanges.at(-1)] : positive;
  const required = active.filter(match => isExplicit(match.clause));
  const chosen = required.length ? required : active;
  const allowed = [...new Set(chosen.map(match => match.value))];
  const alternatives = /两者都可|都行|均可|任选|或者|或是|二选一/.test(text);
  const duplicateExclusion = allowed.some(value => excluded.includes(value));
  const conflict = duplicateExclusion && !explicitChanges.length || required.length > 1 && allowed.length > 1 && !alternatives;
  const level = required.length || excluded.length || explicitChanges.length ? "required" : "preferred";
  const evidence = [...new Set([...chosen, ...matches.filter(match => match.negated)].map(item => item.clause))].join(" ｜ ");
  return defineField(key, allowed.map(value => names[value]).join(" / "), level, "customer", evidence, {
    codes: allowed,
    excluded: explicitChanges.length ? excluded.filter(value => !allowed.includes(value)) : excluded,
    conflict,
  });
}

const suggestedValues = {
  private: {
    style: "克制、简约的新中式",
    silhouette: "H 型直身，肩背与袖管保留松量",
    fabric: "低对比暗纹、垂感适中",
    craft: "暗扣或隐式门襟",
    scene: "正式洽谈或礼仪场合",
    activity: "试穿检查抬臂与站立",
  },
  group: {
    style: "利落、得体的职业形象",
    silhouette: "直身夹克，配合可活动袖窿",
    fabric: "挺而不硬、耐用、易护理",
    craft: "低可见度加固",
    scene: "团队接待与岗位活动",
    activity: "试穿检查伸手和抬臂",
  },
};

const scopeTerms = {
  style: "风格(?:调性)?", silhouette: "廓形|版型", fabric: "面料|布料|用料|面料材质|材质",
  craft: "工艺(?:细节)?|缝制方式", color: "颜色|色彩|配色", scene: "使用场景|穿着场合|场合",
  activity: "活动(?:要求|范围)?|动作(?:要求)?",
};
const alternatives = /或者|或是|或|任选|二选一|都行|均可/;

function assertiveField(text, key, matches) {
  // Only an explicit replacement supersedes a previous value. Constraints on other dimensions survive.
  const updates = text.split(clauseBreak).flatMap(clause=>{
    const pivot = /(?:改为|改用|改成|换为|换用|换成|最终(?:选用?|确定|统一|采用))/u.exec(clause);
    if (!pivot) return [];
    const after = clause.slice(pivot.index+pivot[0].length);
    const changed = detectVocabulary(after,key,true).filter(item=>!item.negated);
    const tentative = /(?:希望|最好|倾向于?|优先考虑|想试试|能否|可否)\s*$/u.test(clause.slice(0,pivot.index)) && !/必须|务必|一定要/u.test(clause);
    return changed.length ? [{clause:clause.trim(),terms:[...new Set(changed.map(item=>item.value))],tentative}] : [];
  }).at(-1);
  if (updates) {
    const hold = matches.filter(item=>item.negated && !updates.terms.includes(item.value));
    return defineField(key,[...updates.terms,...new Set(hold.map(item=>"避免"+item.value))].join("、"),updates.tentative && !hold.length ? "preferred" : "required","customer",
      [...new Set([updates.clause,...hold.map(item=>item.clause)])].join(" ｜ "));
  }
  const local = new RegExp("(?:" + scopeTerms[key] + ")\\s*(?:[：:]\\s*)?(?:只(?:能|可|要)|必须|务必|限定|强制|指定|一定要|不得|不能|不要|禁止)(.*)");
  const grouped = [...new Set([...matches.map(item => item.clause), ...text.split(clauseBreak).map(item => item.trim())])];
  const pieces = [];
  for (const clause of grouped) {
    const explicit = clause.match(local);
    const active = matches.filter(item => item.clause === clause);
    const stated = active.filter(item => {
      if (item.negated) return true;
      if (key === "activity" && item.value === "久站活动" && /迎宾|接待/.test(item.quote)) return false;
      if (!isExplicit(clause)) return false;
      const request = clause.search(/需要|要求/u);
      return request < 0 || clause.indexOf(item.quote) >= request || /必须|只(?:能|用)|不得|不能|务必|统一|禁止|一定要/u.test(clause) ||
        /(?:是)?(?:需要|要求)(?:的)?$/u.test(clause);
    });
    if (explicit) {
      const scoped = explicit[1].replace(/^\s*(?:使用|采用|选用|为|用|是)/, "").trim();
      const unknown = scoped.split(/(?:、|或者|或是|或|以及|与|和)/).map(part => part.trim())
        .filter(part => part && !stated.some(item => item.quote.includes(part)) && !detectVocabulary(part, key, true).length);
      if (!stated.length || unknown.length || /含量|克重|[%％]/.test(scoped) && !/100\s*[%％]\s*羊毛/.test(scoped)) {
        pieces.push({ clause, value: scoped || "待明确" });
        continue;
      }
    }
    if (stated.length) {
      const positives = [...new Set(stated.filter(item => !item.negated).map(item => item.value))];
      const negatives = [...new Set(stated.filter(item => item.negated).map(item => "避免" + item.value))];
      const useAlternatives = alternatives.test(clause) && positives.length > 1;
      const choice = useAlternatives ? positives.join(" / ") : positives.join("、");
      pieces.push({ clause, value: [choice, ...negatives].filter(Boolean).join("、") });
    }
  }
  if (!pieces.length) return null;
  return defineField(key, [...new Set(pieces.flatMap(item => item.value.split("、")))].join("、"), "required", "customer", pieces.map(item => item.clause).join(" ｜ "));
}

function groupField(key, text) {
  if (key === "headcount") {
    const count = text.match(/(?:约(?:为)?|大约|预计|共计|共|合计)?\s*(?:[1-9]\d{0,5}(?:[,，]\d{3})?|[一二两三四五六七八九十百千]+)(?:\s*(?:至|到|[-–~～])\s*(?:\d{1,6}|[一二两三四五六七八九十百千]+))?\s*(?:人|位|名)(?!员)(?:左右|以上|以内)?/);
    if (count) return defineField(key, count[0].trim(), "preferred", "customer", count[0].trim());
  }
  if (key === "wearers") {
    const roles = [...new Set((text.match(/礼宾(?:团队|人员|岗)?|前台(?:团队|人员|岗)?|接待人员|迎宾人员|行政团队|服务团队|物业团队|安保团队|办公室员工|销售团队|演出团队|厨师|保洁人员/g) ?? []))];
    if (roles.length) return defineField(key, roles.join("、"), "preferred", "customer", roles.join(" ｜ "));
  }
  if (key === "replenishment") {
    const match = text.match(/(?:补货|追加(?:订单|订购|采购|货量|数量|一批|\s*[一二两三四五六七八九十百千\d]+\s*(?:套|件|单))|续订|补单)/);
    if (match) {
      const clause = segmentFor(text, match.index);
      const needed = !isNegated(text, match.index) && !isWaived(text, match.index);
      return defineField(key, needed ? "需要后续补货" : "暂无补货要求", "preferred", "customer", clause);
    }
  }
  return defineField(key, "", "unspecified", "pending");
}

const lengthUnit = "毫米|公厘|mm|厘米|公分|cm|英寸|吋|in(?![a-z])|米|m(?![a-z])";
const lengthAmount = "\\d{1,4}(?:[.．]\\d{1,3})?";
const atLeast = /不少于|至少|不低于|不能少于|不得低于|不小于|≥|以上/;
const atMost = /不超过|至多|最多|不能超过|不得超过|不大于|≤|以下|以内/;
const lengthRule = new RegExp("^(?:(?<bound>约|大约|大概|" + atLeast.source + "|" + atMost.source + ")\\s*)?(?<amount>" + lengthAmount
  + ")\\s*(?<unit>" + lengthUnit + ")?\\s*(?:(?<separator>至|到|±|[~～–—-])\\s*(?<upper>" + lengthAmount
  + ")\\s*(?<upperUnit>" + lengthUnit + ")?)?\\s*(?<ending>及以上|及以下|以上|以下|以内)?", "i");

function asMillimeters(amount, unit) {
  const scale = /^(?:cm|厘米|公分)$/i.test(unit) ? 10 : /^(?:m|米)$/i.test(unit) ? 1000 : /^(?:in|英寸|吋)$/i.test(unit) ? 25.4 : 1;
  return Number((Number(amount.replace("．", ".")) * scale).toFixed(3));
}

function readMeasurement(value, full = false) {
  const input = cleanText(value);
  const match = input.match(lengthRule);
  if (!match) return null;
  if (full && match[0].trim() !== input) return null;
  const { bound, amount, unit, separator, upper, upperUnit, ending } = match.groups;
  if (!(unit || upperUnit)) return null;
  const first = asMillimeters(amount, unit || upperUnit);
  const second = upper ? asMillimeters(upper, upperUnit || unit) : null;
  if (!Number.isFinite(first) || first <= 0) return null;
  if (second !== null) {
    const min = separator === "±" ? Number((first - second).toFixed(3)) : first;
    const max = separator === "±" ? Number((first + second).toFixed(3)) : second;
    return min <= 0 || max < min || bound || ending ? null : {
      label: separator === "±" ? first+" ± "+second+" mm" : min + "–" + max + " mm", min, max,
      target: separator === "±" ? first : null,
    };
  }
  const minimum = atLeast.test(bound ?? ending ?? "");
  if (minimum) return { label: "至少 " + first + " mm", min: first, max: Infinity };
  if (atMost.test(bound ?? ending ?? "")) return { label: "最多 " + first + " mm", min: 0, max: first };
  return { label: (bound ? "约 " : "") + first + " mm", min: first, max: first };
}

function extractFitField(key, label, text) {
  const measureLead = "(?:(?:尺寸|目标|最终|必须|一定要|要求|设为|改成|改为|定为|希望|可以|优先考虑|控制在|做成|是|为|在|要)\\s*){0,4}";
  const quoteCandidates = [...text.matchAll(new RegExp("(?:" + label.source + ")\\s*(?:[:：]\\s*)?" + measureLead + "(?:[:：]\\s*)?", "g"))];
  const measurements = quoteCandidates.flatMap(matched => {
    if (key === "chestRequest" && /成衣\s*$/.test(text.slice(Math.max(0, matched.index - 6), matched.index))) return [];
    let remainder = text.slice(matched.index + matched[0].length).trimStart();
    const replacing = remainder.match(new RegExp("^(?:由|从)\\s*"+lengthAmount+"\\s*(?:"+lengthUnit+")?\\s*(?:改为|改成|改到|调至|调整到|换成|→|->)\\s*","iu"));
    if (replacing) remainder = remainder.slice(replacing[0].length);
    const incomplete = remainder.match(lengthRule)?.[0].trim();
    const value = readMeasurement(remainder) ?? (incomplete ? { label: incomplete + "（单位或范围待确认）" } : null);
    if (!value) return [];
    const clause = segmentFor(text, matched.index);
    return [{ clause, value, required: Boolean(replacing) || isExplicit(clause), changed: Boolean(replacing) || /(?:改成|改为|更改|最终)/.test(clause) }];
  });
  if (!measurements.length) return null;
  const changed = measurements.findLast(item => item.changed);
  const selected = changed ? [changed] : measurements;
  const values = [...new Set(selected.map(item => item.value.label))];
  const level = selected.some(item => item.required) ? "required" : "preferred";
  return defineField(key, values.join(" / "), level, "customer", [...new Set(selected.map(item => item.clause))].join(" ｜ "), { conflict: values.length > 1 });
}

function parsePlacketRequest(field) {
  if (!field?.value || field.level === "unspecified" || field.conflict) return null;
  return readMeasurement(field.value, true);
}

export function extractRequirements({ text = "", scene } = {}) {
  text = cleanText(text);
  scene = inferScene(scene, text);
  const suggestions = suggestedValues[scene];
  const lowNeck = text.match(/(?:领子|领口|领型|立领|领高)[^。\n]{0,12}?(?:不能|不要|不宜|别)(?:太|过)?高/u);
  const fields = definitions.map(([key]) => {
    if (key === "collar") {
      const collarMentions = [...text.matchAll(collarExpression)].map(match=>match[0]);
      if (lowNeck && (!collarMentions.length || collarMentions.every(term=>term==="立领") && !/不要立领|无立领|不做立领/.test(text))) {
        return defineField(key, "低立领", "preferred", "agent", lowNeck[0]);
      }
      if (text.search(collarExpression) === -1 && /领(?:型|口|子)?.{0,4}(?:没想好|还没定|不确定|不限|无要求)/.test(text)) {
        return defineField(key, "未指定", "unspecified", "pending");
      }
      return detectChoice({ key, text, expression: collarExpression, code: collarCode, names: collarNames, defaultText: scene === "private" ? "交领开襟" : "西装翻驳领" });
    }
    if (key === "care") return detectChoice({ key, text, expression: careExpression, code: careCode, names: careNames });
    let dimensionText = text;
    if (key === "color") {
      const reset = [...text.matchAll(/(?:颜色|色彩|主色|配色)[^，。；\n]{0,6}?(?:没想好|不确定|不限|无所谓|无(?:特殊)?要求|还没定|暂未(?:决定|确定)|待定|取消|尚未确定)/gu)].at(-1);
      if (reset) {
        dimensionText = text.slice(reset.index+reset[0].length);
        const later = detectVocabulary(dimensionText,key,true);
        if (!later.some(item=>item.negated || isExplicit(item.clause) || /确定|改为|改成|定为|改用|选用/.test(item.clause))) {
          return defineField(key,"未指定","unspecified","pending",reset[0]);
        }
      }
    }
    const allMatches = detectVocabulary(dimensionText, key, true);
    const forced = assertiveField(dimensionText, key, allMatches);
    if (forced) return forced;
    const matches = allMatches.filter(item => !item.negated);
    if (matches.length) {
      const clauses = [...new Set(matches.map(item => item.clause))];
      return defineField(key, [...new Set(matches.map(item => item.value))].join("、"), "preferred", "customer", clauses.join(" ｜ "));
    }
    if (suggestions[key]) return defineField(key, suggestions[key], "preferred", "agent");
    return defineField(key, key === "color" ? "未指定" : "", "unspecified", "pending");
  });
  if (scene === "group") fields.push(...groupDefinitions.map(([key]) => groupField(key, text)));
  const bodyDescriptions = [...text.matchAll(/(?:身形|身材|个子|身高)(?:比较|较|偏|有些|稍微)[高矮]|肩背(?:比较|较|偏|略)?(?:宽厚|宽阔|宽)|(?:有点|有一点|略有)?溜肩|脖子(?:比较|较|偏)短|(?:有点|有一点|有)?小肚腩|有肚腩/gu)]
    .filter(match=>!/(?:不是|并非|没有|并无|不属于|避免)\s*$/u.test(text.slice(0,match.index)));
  if (bodyDescriptions.length) {
    fields.push(defineField("bodyDescription",[...new Set(bodyDescriptions.map(item=>item[0]))].join("、"),"preferred","customer",
      [...new Set(bodyDescriptions.map(item=>segmentFor(text,item.index)))].join(" ｜ ")));
  }
  const lastScope = [...text.matchAll(/(?:本次|这次|本单)?\s*(?:只做|仅做|仅制作|只定制)([^，。；\n]{1,36})/gu)].at(-1);
  const scopeText = lastScope?.[1] ?? text;
  const missingItems = [...scopeText.matchAll(/连衣裙|半身裙|西裤|长裤|衬衫|马甲|短裙|短裤/gu)].filter(m=>{
    const clause = segmentFor(scopeText,m.index);
    return !isNegated(scopeText,m.index) && !isWaived(scopeText,m.index) && !/已有|自备|另立项目|另行定制|另开项目|内搭现有|搭配已有/.test(clause)
      && !/(?:里面搭|内搭|搭配|配搭)[^，。；\n]{0,10}$/.test(scopeText.slice(Math.max(0,m.index-16),m.index));
  });
  if (missingItems.length) {
    const items = [...new Set([...( /外套|夹克|西装上衣/.test(scopeText) ? ["外套"] : []), ...missingItems.map(m=>m[0])])];
    fields.push(defineField("garmentScope",items.join("、"),"required","customer",segmentFor(scopeText,missingItems[0].index)));
  }
  const motif = [...text.matchAll(/(?:花型|图案|纹样|暗纹|花纹)[^。；\n]{0,18}?[，,]\s*((?:最好是|希望是|必须是|只接受|改成|改为|改用)[^，。；\n]{1,32})/gu),
    ...text.matchAll(/(?:花型|图案|纹样|花纹)(?:希望|必须|最好|想)?(?:用|是|为|改成|改为|改用|采用)\s*([^，。；\n]{1,32})/gu)].sort((a,b)=>a.index-b.index).at(-1);
  const regional = text.match(/地域(?:特色|风格|元素)|地方(?:特色|元素)|家乡(?:文化|元素)/u);
  const place = regional && text.match(/(?:我是|我来自|家乡是)([\u4e00-\u9fff]{2,8}?)(?:人|[，。；\n])/u);
  if (motif || regional) {
    const value = [motif?.[1],regional ? (place?.[1] ?? "本地")+regional[0] : ""].filter(Boolean).join("、");
    const evidence = [motif?.[0],place?.[0],regional?.[0]].filter(Boolean).join(" ｜ ");
    fields.push(defineField("designDetail",value,motif && /必须|只接受/.test(motif[0])?"required":"preferred","customer",evidence));
  }
  fields.push(...fitDefinitions.map(([key, , label]) => extractFitField(key, label, text)).filter(Boolean));
  if (lowNeck && !fields.some(field=>field.key==="collarHeightRequest")) {
    fields.push(defineField("collarHeightRequest","领高偏低，具体数值待量体","preferred","customer",lowNeck[0]));
  }
  const narrowNeck = text.match(/(?:领子|领型|领口)[^。\n]{0,15}?(?:要|希望|喜欢)(?:再|稍微)?窄(?:一点|一些)?/u);
  if (narrowNeck && !fields.some(field=>field.key==="collarWidthRequest")) fields.push(defineField("collarWidthRequest","领型偏窄，实际领宽待量体","preferred","customer",narrowNeck[0]));
  const grounded = [
    ...detectVocabulary(text, "style"),
    ...detectVocabulary(text, "fabric").filter(item => ["细暗纹", "哑光", "有垂感", "肌理"].includes(item.value)),
  ];
  const aestheticEvidence = [...new Map(grounded.map(item => [item.value, { tag: item.value, quote: item.clause }])).values()];
  const questions = [];
  if (fields.find(field => field.key === "collar").conflict) questions.push("领型要求互相冲突，请确认最终采用哪一种领型。");
  if (fields.find(field => field.key === "care").conflict) questions.push("护理要求互相冲突，请确认是否必须可机洗。");
  if (fields.find(field => field.key === "color").level === "unspecified") questions.push("色彩尚未指定，可先确认结构，后续以选色或色卡为准。");
  if (missingItems.length) questions.push("本单涉及"+missingItems.map(m=>m[0]).join("、")+"，请顾问拆分单品或补充对应模拟基版。");
  const fit = fields.filter(field => fitKeys.has(field.key) && field.key !== "placketWidthRequest");
  if (fit.length) questions.push("衣长、围度等填报值作为量体与试穿交接目标，需由业务人员确认测量基准与成衣尺寸。");
  const placket = fields.find(field => field.key === "placketWidthRequest");
  if (placket?.conflict) questions.push("门襟宽度存在多个读数，请确认一个目标或范围。");
  else if (placket && !parsePlacketRequest(placket)) questions.push("请确认门襟宽度的单位及尺寸范围。");
  if (!text) questions.unshift("请补充客户原话或手填明确的需求。");
  return { sourceText: text, fields, aestheticTags: aestheticEvidence.length ? aestheticEvidence.map(item => item.tag) : [scene === "group" ? "得体" : "克制"], aestheticEvidence, questions };
}

const levels = new Set(["required", "preferred", "unspecified"]);
const sources = new Set(["customer", "agent", "pending", "advisor"]);

export function normalizeRequirements(requirements) {
  const items = Array.isArray(requirements) ? requirements : requirements?.fields;
  const input = Array.isArray(items) ? items : [];
  const optional = [...groupDefinitions, ...fitDefinitions, ...designDefinitions];
  const relevant = [...definitions, ...optional.filter(([key]) => input.some(item => item?.key === key))];
  return relevant.map(([key]) => {
    const field = input.find(item => item?.key === key);
    if (!field) return defineField(key, "", "unspecified", "pending");
    const value = cleanText(field.value);
    const level = levels.has(field.level) && (value || field.level === "required") ? field.level : "unspecified";
    const source = sources.has(field.source) ? field.source : "pending";
    const extra = {};
    if (source === "customer" && field.conflict === true) extra.conflict = true;
    if (key === "collar" || key === "care") {
      const readCode = key === "collar" ? collarCode : careCode;
      const parts = value.split(/\s*[/、或]\s*/).filter(Boolean);
      const negatives = parts.filter(part => negativeTerm.test(part));
      const positives = parts.filter(part => !negativeTerm.test(part));
      extra.codes = [...new Set(positives.map(readCode).filter(code => code !== "unknown"))];
      if (level === "required" && extra.codes.length > 1 && !/[\/或]|任选|都行|均可|二选一/.test(value)) extra.conflict = true;
      extra.unrecognized = parts.some(part => readCode(part) === "unknown");
      extra.excluded = [...new Set([
        ...negatives.map(readCode),
        ...(source === "customer" && Array.isArray(field.excluded) ? field.excluded : []),
      ].filter(code => typeof code === "string" && code !== "unknown"))];
    }
    return defineField(key, value, level, source, cleanText(field.evidence), extra);
  });
}

function fieldMap(requirements) {
  return Object.fromEntries(normalizeRequirements(requirements).map(field => [field.key, field]));
}

function hard(field) {
  return field?.level === "required";
}

function evaluateCode(actual, field, names) {
  if (!hard(field)) return null;
  if (field.unrecognized || !field.codes?.length && !field.excluded?.length) return ["needsReview", "请和客户核对「" + field.value + "」的具体含义，再按" + field.label + "筛选。"];
  if (actual == null || actual === "unknown") return ["needsReview", "资料卡未注明" + (field.key === "care" ? "护理方式" : field.label) + "，还不能确认是否符合「" + field.value + "」。"];
  if (field.excluded?.includes(actual) || field.codes?.length && !field.codes.includes(actual)) {
    return ["rejected", "本单要求「" + field.value + "」，资料卡登记为「" + (names[actual] ?? actual) + "」。"];
  }
  return null;
}

function normalized(value) {
  return value.toLowerCase().replace(/深藏蓝|海军蓝|藏青/g, "藏蓝");
}

const negativeTerm = /^(?:避免|不要|不用|不能(?:使用|用)?|不可(?:使用|用)?|禁止(?:使用|用)?|不接受)\s*/;
const fabricMaterials = new Set(["真丝", "羊毛", "棉", "棉混纺", "亚麻", "羊绒", "皮革"]);
const fabricMaterialEvidence = { "FAB-001": "真丝", "FAB-004": "羊毛", "FAB-005": "棉混纺" };
const patternSceneEvidence = {
  "PAT-001": ["正式场合"], "PAT-002": ["正式场合"],
  "PAT-004": ["酒店礼宾", "室内接待", "室外迎宾", "户外使用"],
  "PAT-005": ["正式场合", "酒店礼宾"], "PAT-006": ["酒店礼宾", "室内接待"],
  "PAT-007": ["日常休闲"], "PAT-008": ["正式场合", "办公室商务"],
};
const patternSilhouetteEvidence = {
  "PAT-001": ["直身 H 型", "宽松舒展", "肩背留量"],
  "PAT-002": ["直身 H 型", "宽松舒展", "肩背留量"],
  "PAT-003": ["直身 H 型", "宽松舒展"],
  "PAT-004": ["直身 H 型", "肩背留量"],
  "PAT-006": ["直身 H 型", "肩背留量"],
  "PAT-007": ["宽松舒展", "肩背留量"], "PAT-008": ["修身轮廓"],
};
const assetCriteria = {
  pattern: ["style", "silhouette", "scene", "activity"], fabric: ["fabric", "color"], craft: ["craft"], case: [],
};

function evidenceStatus(asset, key, term) {
  if (key === "color") {
    if (!asset.colors?.length || term === "撞色") return "unknown";
    return asset.colors.some(value => shadeSatisfies(value, term)) ? "yes" : "no";
  }
  if (key === "silhouette" && patternSilhouetteEvidence[asset.id]) {
    if (patternSilhouetteEvidence[asset.id].includes(term)) return "yes";
    if (term === "修身轮廓" || patternSilhouetteEvidence[asset.id].includes("修身轮廓")) return "no";
  }
  if (key === "activity" && ["抬臂舒展", "搬运行李"].includes(term)) {
    return asset.mobility == null ? "unknown" : asset.mobility ? "yes" : "no";
  }
  if (key === "fabric" && fabricMaterials.has(term)) {
    const material = fabricMaterialEvidence[asset.id];
    return material == null ? "unknown" : term === material || term === "棉" && material === "棉混纺" ? "yes" : "no";
  }
  if (key === "scene") return patternSceneEvidence[asset.id]?.includes(term) ? "yes" : "unknown";
  const nameAndTags = [asset.name, ...asset.tags].join("、");
  const recorded = new Set(detectVocabulary(nameAndTags, key).map(item => item.value));
  if (recorded.has(term) || term === "盘扣" && recorded.has("手工盘扣") || term === "绣标" && recorded.has("机绣标识")) return "yes";
  if (key === "craft") return "no";
  return "unknown";
}

function hardOptions(key, value) {
  return value.split(/(?:[、，,；;]|以及|与|和)/).filter(Boolean).map(part => part.trim().split(/\s*(?:\/|或者|或是|或)\s*/).map(option => {
    const negative = negativeTerm.test(option);
    const content = option.replace(negativeTerm, "").trim();
    const exact = vocab[key].find(([term]) => term === content);
    const neutral = content.replace(/^(?:用|采用|使用|选用|选|必须|要求|指定|可用|需采用)+/, "").replace(/(?:工艺|面料|颜色|为主|即可|都可|也可)$/, "");
    const matches = detectVocabulary(neutral, key).filter(item => item.quote === neutral);
    return { negative, term: exact?.[0] ?? matches.sort((first, second) => second.quote.length - first.quote.length)[0]?.value };
  }));
}

function recordedFeature(asset, key, value) {
  if (key === "collar") return collarNames[asset.collar];
  if (key === "color") return asset.colors?.join("、");
  if (key === "fabric" && hardOptions(key, value).flat().every(option => fabricMaterials.has(option.term))) return fabricMaterialEvidence[asset.id];
  if (key === "silhouette") return patternSilhouetteEvidence[asset.id]?.join("、");
}

function evaluateEvidence(asset, field) {
  if (!hard(field)) return null;
  const groups = hardOptions(field.key, field.value);
  if (!groups.length || groups.some(group => group.some(option => !option.term))) {
    return ["needsReview", "现有资料无法判定「" + field.value + "」。请先确认" + field.label + "的具体要求。"];
  }
  let pending = false;
  for (const group of groups) {
    const outcomes = group.map(({ term, negative }) => {
      const status = evidenceStatus(asset, field.key, term);
      if (negative && field.key === "fabric" && fabricMaterials.has(term) && status === "no") return "unknown";
      return !negative || status === "unknown" ? status : status === "yes" ? "no" : "yes";
    });
    if (outcomes.every(status => status === "no")) {
      const recorded = recordedFeature(asset, field.key, field.value);
      return ["rejected", recorded
        ? "本单要求「" + field.value + "」，资料卡登记为「" + recorded + "」。"
        : "这项资源不符合本单的" + field.label + "「" + field.value + "」。"];
    }
    if (!outcomes.includes("yes")) pending = true;
  }
  return pending ? ["needsReview", "资料卡未写明是否符合「" + field.value + "」，请核对" + field.label + "。"] : null;
}

function conflictsWithChoice(asset, fields) {
  if (asset.type === "pattern") {
    if (asset.collar === "stand" && fields.collarHeightRequest?.value.startsWith("领高偏低")) return ["needsReview","客户希望领口低一些，请先核对这款立领基版的实际领高。"];
    const collar = evaluateCode(asset.collar, fields.collar, collarNames);
    if (collar) return collar;
  }
  if (asset.type === "fabric") {
    const care = evaluateCode(asset.care, fields.care, careNames);
    if (care) return care;
  }
  for (const key of assetCriteria[asset.type]) {
    const decision = evaluateEvidence(asset, fields[key]);
    if (decision) return decision;
  }
  return null;
}

function compatibility(pattern, fabric, craft) {
  if (craft.collars && !craft.collars.includes(pattern.collar)) return "该工艺与所选领型不适配";
  if (craft.mobility === true && pattern.mobility !== true) return "该活动工艺需要已确认支持抬臂的版型";
  if (craft.weightClasses && !craft.weightClasses.includes(fabric.weightClass)) return "该工艺与所选面料厚度不适配";
  return "";
}

const assetTypes = ["pattern", "fabric", "craft", "case"];

// Vocabulary aliases and specialist evidence are shared with the Python SQL matcher.
// Scene filtering, ranking and compatible combination search stay in the calling matcher.
export function matchingEvidence(requirements,scene) {
  const fields=fieldMap(requirements),source=sourceContextFor(requirements?.sourceText,scene);
  const evidence={};
  for(const item of catalog){
    const check=assetCriteria[item.type].map(key=>evaluateEvidence(item,fields[key])).find(Boolean);
    let reference=source?.assetReferences[item.id]||null;
    const key=item.type==="pattern"?"collar":item.type,preference=fields[key];
    if(reference&&item.type!=="case"&&preference?.level==="preferred"&&["customer","advisor"].includes(preference.source)){
      const required={...preference,level:"required"};
      if(key==="collar"?evaluateCode(item.collar,required,collarNames):evaluateEvidence(item,required))reference=null;
    }
    const preferredFabric=Boolean(source?.hasAddendum&&item.type==="fabric"&&fields.fabric.level==="preferred"&&
      ["customer","advisor"].includes(fields.fabric.source)&&!evaluateEvidence(item,{...fields.fabric,level:"required"}));
    evidence[item.id]={check:check||null,reference,preferredFabric};
  }
  const width=parsePlacketRequest(fields.placketWidthRequest);
  return {fields,evidence,sourceId:source?.id||null,criteria:assetCriteria,choiceLabels:{collar:collarNames,care:careNames},knownKeys:Object.keys(definitionByKey),width};
}

export function matchResources({ requirements, scene } = {}) {
  scene = normalizeScene(scene);
  const fields = fieldMap(requirements);
  const source = sourceContextFor(requirements?.sourceText, scene);
  const eligible = [];
  const rejected = [];
  const needsReview = [];
  const categories = { eligible, rejected, needsReview };
  const text = Object.values(fields).map(field => normalized(field.value + " " + field.evidence)).join(" ");
  for (const item of catalog) {
    if (!item.scenes.includes(scene)) {
      rejected.push({ ...item, reason: scene === "group" ? "这项资源用于高级私定，本单为团体职业服。" : "这项资源用于团体职业服，本单为高级私定。" });
      continue;
    }
    const conflict = conflictsWithChoice(item, fields);
    if (conflict) {
      categories[conflict[0]].push({ ...item, reason: conflict[1] });
      continue;
    }
    const hits = item.tags.filter(tag => text.includes(normalized(tag)));
    const confirmed = [...assetCriteria[item.type], ...(item.type === "pattern" ? ["collar"] : item.type === "fabric" ? ["care"] : [])]
      .filter(key => hard(fields[key])).map(key => fields[key].value);
    const hardReason = confirmed.length ? "符合本单要求：" + confirmed.join("、") : "";
    let sourceReference = source?.assetReferences[item.id];
    if (sourceReference && item.type !== "case") {
      const key = item.type === "pattern" ? "collar" : item.type;
      const preference = fields[key];
      if (preference?.level === "preferred" && ["customer","advisor"].includes(preference.source)) {
        const asRequired = {...preference,level:"required"};
        const mismatch = key === "collar" ? evaluateCode(item.collar,asRequired,collarNames) : evaluateEvidence(item,asRequired);
        if (mismatch) sourceReference = null;
      }
    }
    const reason = [hardReason, hits.length ? "对应标签：" + hits.join("、") : (scene === "group" ? "适合团体职业服" : "适合高级私定"),
      sourceReference ? source.id+" 模拟案例参考："+sourceReference : ""].filter(Boolean).join("。");
    const preferenceBonus = item.type === "pattern" && fields.collar.codes?.includes(item.collar) ||
      item.type === "fabric" && fields.care.codes?.includes(item.care) ? 5 : 0;
    const changedFabricPreference = source?.hasAddendum && item.type === "fabric" && fields.fabric.level === "preferred"
      && ["customer","advisor"].includes(fields.fabric.source) && !evaluateEvidence(item,{...fields.fabric,level:"required"});
    eligible.push({ ...item, score: item.rank + hits.length * 3 + preferenceBonus + (sourceReference ? 24 : 0)
      + (changedFabricPreference ? 15 : 0), reason });
  }
  eligible.sort((first, second) => second.score - first.score || first.id.localeCompare(second.id));
  const byType = Object.fromEntries(assetTypes.map(type => [type, eligible.filter(item => item.type === type)]));
  const recommended = { pattern: null, fabric: null, craft: null, case: byType.case[0]?.id ?? null };
  const rawFields = Array.isArray(requirements) ? requirements : requirements?.fields;
  if (Array.isArray(rawFields) && rawFields.some(field => hard(field) && !Object.hasOwn(definitionByKey, field.key))) {
    return { eligible, rejected, needsReview, recommended, blocked: true, reason: "有一项必选条件尚未纳入模拟资源库，请回到设计参数页核对。" };
  }
  const contradiction = [fields.collar, fields.care].find(field => field.conflict);
  if (fields.garmentScope?.value && /连衣裙|半身裙|西裤|长裤|衬衫|马甲|短裙|短裤/.test(fields.garmentScope.value)) {
    return {eligible,rejected,needsReview,recommended,blocked:true,reason:"本单交付品类为「"+fields.garmentScope.value+"」，模拟库只有外套、夹克和西装上衣基版。请确认分单范围或由版师补充其余单品基版。"};
  }
  if (hard(fields.designDetail)) return {eligible,rejected,needsReview,recommended,blocked:true,reason:"还没有可核对的花型样卡，请先确认客户指定的纹样。"};
  if (contradiction) {
    return { eligible, rejected, needsReview, recommended, blocked: true, reason: contradiction.label + "的要求有冲突，请和客户核对。" };
  }
  const placketLimit = parsePlacketRequest(fields.placketWidthRequest);
  if (hard(fields.placketWidthRequest) && (!placketLimit || placketLimit.min > 50 || placketLimit.max < 20)) {
    return { eligible, rejected, needsReview, recommended, blocked: true, reason: placketLimit ? "要求的门襟宽度超出模拟基版的 20–50 mm 范围，请版师核对。" : "请先确认门襟宽度的数值、单位或允许范围。" };
  }
  const manualFit = Object.values(fields).filter(field => fitKeys.has(field.key) && field.key !== "placketWidthRequest" && field.value && field.level !== "unspecified");
  for (const pattern of byType.pattern) {
    for (const fabric of byType.fabric) {
      const craft = byType.craft.find(item => !compatibility(pattern, fabric, item));
      if (!craft) continue;
      Object.assign(recommended, { pattern: pattern.id, fabric: fabric.id, craft: craft.id });
      const reason = "这组版型、面料与工艺可以搭配，已核对领型、肩袖活动量和面料厚度。" + (manualFit.length ? "量体数据和成衣尺寸仍需版师复核。" : "");
      return { eligible, rejected, needsReview, recommended, blocked: false, reason };
    }
  }
  const absent = !byType.pattern.length ? "版型" : !byType.fabric.length ? "面料" : !byType.craft.length ? "工艺" : "";
  const reason = absent ? "还没有符合本单要求的" + absent + "。请核对已排除和待核对的资源。"
    : "候选版型、面料和工艺暂时配不成一套，请核对领型、活动量和面料厚度。";
  return { eligible, rejected, needsReview, recommended, blocked: true, reason };
}

function domainError(code, message) {
  const error = new Error(message);
  return Object.assign(error, { code, status: 422 });
}

function optionValue(value) {
  return typeof value === "string" ? value : value?.id;
}

function preferenceHandoffs(fields, { pattern, fabric, craft }) {
  const checks = [];
  for (const [key, asset] of [["collar", pattern], ["silhouette", pattern], ["fabric", fabric], ["color", fabric], ["craft", craft]]) {
    const field = fields[key];
    if (field.level !== "preferred" || !field.value || !["customer", "advisor"].includes(field.source)) continue;
    const confirmed = { ...field, level: "required" };
    const result = key === "collar" ? evaluateCode(asset.collar, confirmed, collarNames) : evaluateEvidence(asset, confirmed);
    if (!result) continue;
    const recorded = recordedFeature(asset, key, field.value);
    const resource = asset.id + "「" + asset.name + "」";
    const checkWith = {collar: "版型图", silhouette: "试穿样衣", fabric: "样布", color: "色卡", craft: "工艺样"}[key];
    const note = result[0] === "rejected"
      ? (recorded ? "登记为「" + recorded + "」" : "与这项偏好不符") + "，请确认是否改选。"
      : "的资料卡未写明这一点，请对照" + checkWith + "核实。";
    checks.push("本单偏好「" + field.value + "」。" + resource + note);
  }
  return checks;
}

export function createSolution({ requirements, scene, selected, version = 1, placketWidth, title } = {}) {
  scene = normalizeScene(scene);
  const fields = fieldMap(requirements);
  const currentMatch = matchResources({ requirements, scene });
  if (currentMatch.blocked) throw domainError("MATCH_BLOCKED", currentMatch.reason);
  const chosen = Object.fromEntries(assetTypes.map(type => [type, optionValue(selected?.[type]) ?? currentMatch.recommended[type]]));
  const assets = assetTypes.flatMap(type => {
    if (type === "case" && !chosen.case) return [];
    const match = currentMatch.eligible.find(item => item.id === chosen[type] && item.type === type);
    if (!match) throw domainError("ASSET_INELIGIBLE", "资产 " + (chosen[type] ?? type) + " 不符合已确认的要求。");
    return [match];
  });
  const [pattern, fabric, craft, reference] = assets;
  const conflict = compatibility(pattern, fabric, craft);
  if (conflict) throw domainError("ASSET_INCOMPATIBLE", conflict);
  const placketRequest = parsePlacketRequest(fields.placketWidthRequest);
  const canApplyPlacket = placketRequest && placketRequest.min <= 50 && placketRequest.max >= 20;
  const width = placketWidth != null ? Number(placketWidth) : canApplyPlacket ? Math.min(50,placketRequest.max, Math.max(20,placketRequest.min, placketRequest.target ?? 30)) : 30;
  if (!Number.isFinite(width) || width < 20 || width > 50) throw domainError("DIMENSION_OUT_OF_RANGE", "门襟宽的模拟模板范围为 20–50 mm。");
  if (hard(fields.placketWidthRequest) && (width < placketRequest.min || width > placketRequest.max)) {
    throw domainError("DIMENSION_REQUIREMENT_CONFLICT", "图纸门襟宽不符合已确认的目标「" + fields.placketWidthRequest.value + "」，请调整图纸值或先复核参数。");
  }
  if (!Number.isSafeInteger(version) || version < 1) throw domainError("INVALID_VERSION", "方案版本必须是正整数。");

  const visualColor = colorBrief(fields.color, fabric);
  const color = visualColor.status === "pending"
    ? (visualColor.request ? "颜色要求「" + visualColor.request + "」待核" : "色彩未指定") + (visualColor.hex ? "，暂以" + visualColor.value + "示意" : "")
    : visualColor.value;
  const use = scene === "group" ? "团队接待、迎宾及岗位活动" : "正式私定场合";
  const planTitle = cleanText(title).slice(0, 120) || (scene === "group" ? "礼宾职业服方案" : "海派定制外套方案");
  const contextualValue = key => fields[key]?.level !== "unspecified" ? fields[key]?.value : "";
  const count = scene === "group" && contextualValue("headcount");
  const wearers = scene === "group" && contextualValue("wearers");
  const activity = contextualValue("activity");
  const restock = scene === "group" && contextualValue("replenishment");
  const body = contextualValue("bodyDescription");
  const trialChecks = { 抬臂舒展: "抬手时肩袖是否受限", 搬运行李: "搬运行李是否方便", 久站活动: "久站是否舒适", 坐姿舒适: "坐下时衣身是否绷紧", 腰腹宽松: "腰腹松量是否合适" };
  const wearNotes = [
    [count && "本单" + count.replace(/(?:名|位)$/, "人"), wearers && "供" + (/^(礼宾|前台)$/.test(wearers) ? wearers + "人员" : wearers) + "穿着"].filter(Boolean).join("，"),
    activity && (fields.activity.source === "agent" && activity.startsWith("试穿检查")
      ? "建议试穿时检查" + activity.slice(4) + "是否自如"
      : "试穿重点：" + activity.split("、").map(item => trialChecks[item] || item).join("、")),
    restock, body && "体型记录：" + body,
  ].filter(Boolean);
  const fitRequests = Object.values(fields).filter(field => fitKeys.has(field.key) && field.value && field.level !== "unspecified");
  const highlights = [pattern, fabric, craft].map(item => item.id + "「" + item.name + "」" + item.description.replace(/。$/, ""));
  const sections = [
    { title: "风格和场景", body: [fields.style.value, fields.scene.value || use].filter(Boolean).join("。") + "。" },
    ...(wearNotes.length ? [{ title: scene === "group" ? "岗位与交付需求" : "试穿与活动需求",
      body: wearNotes.join("。") + "。" }] : []),
    { title: "版型选择", body: "选用" + pattern.name + "。" + pattern.description },
    { title: "面料推荐", body: "推荐" + fabric.name + "。" + fabric.description },
    { title: "工艺组合", body: "采用" + craft.name + "。" + craft.description },
    ...(fitRequests.length ? [{ title: "尺寸交接与测量基准", body: fitRequests.map(item => item.label + "：" + item.value
      + (item.key === "placketWidthRequest" ? "（参考图纸为 " + width + " mm，版师复核）" : "（量体与试穿待核）")).join("。") + "。" }] : []),
    { title: "颜色与亮点", body: color + "。" + highlights.join("。") + "。" },
    { title: "历史参考", body: reference ? "参考「" + reference.name + "」。" + reference.description : "模拟案例库里暂时没有合适的参考。" },
  ];
  const checks = scene === "group"
    ? ["按尺码安排试穿，请穿着者试试站立、伸手和搬运时是否方便。", "核对尺码和洗后色牢度，补货时比对批次色差。", "实际护理标识需以样衣、面料及辅料测试为准。"]
    : ["量体后核对肩点、袖窿和衣长，试穿时看看抬臂是否受限。", "核对所选「" + fabric.name + "」的实物质感，以及「" + craft.name + "」与领口、门襟的组合。", "门襟毫米数是模拟基版测点，正式尺寸由版师确认。"];
  if (craft.id === "TEC-009") checks.push("此组合使用无扣开襟与侧衩挡布。对照样衣复核襟缘掩合、贴边宽与侧衩位置。");
  const reusedChecks = Array.isArray(requirements?.reusedChecks)
    ? [...new Set(requirements.reusedChecks
      .filter(item => typeof item === "string")
      .map(item => cleanText(item).slice(0, 180))
      .filter(item => item && !/\d+(?:\.\d+)?\s*(?:mm|cm|毫米|厘米)|(?:^|[^\d])(?:\+?86[\s-]?)?1[3-9]\d{9}(?!\d)|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(item)))].slice(0, 12)
    : [];
  const fitReview = fitRequests.filter(item => item.key !== "placketWidthRequest");
  const preferences = preferenceHandoffs(fields, { pattern, fabric, craft });
  const source = sourceContextFor(requirements?.sourceText,scene);
  if (source) {
    for (const note of source.reviewNotes) preferences.push("模拟案例复核："+note);
    for (const [assetId,note] of Object.entries(source.assetReferences)) {
      const originalAsset = catalog.find(item=>item.id===assetId);
      if (originalAsset && originalAsset.type !== "case" && chosen[originalAsset.type] !== assetId) {
        preferences.push("本版未采用模拟案例提示的候选 "+assetId+"（"+note+"）。请核对这次选用的资源。");
      }
    }
  }
  if (fields.designDetail?.value) preferences.push("请顾问对照样布和设计稿，与客户确认「"+fields.designDetail.value+"」的具体纹样。");
  if (!visualColor.catalogEvidence) preferences.push("对照实物色卡和染色批次确认主色，视觉色值用于方案沟通。");
  return {
    id: "SOL-" + globalThis.crypto.randomUUID(),
    version, scene, title: planTitle, selected: chosen, assets,
    sourceText: typeof requirements?.sourceText === "string" ? requirements.sourceText.slice(0, 4200) : "",
    summary: pattern.name + " × " + fabric.name + " × " + craft.name,
    sections, checks: [...checks, ...preferences, ...fitReview.map(item => "人工复核「" + item.label + " " + item.value + "」的测量方法和试穿结果。"), ...reusedChecks.map(item => "复用检查项：" + item)], reusedChecks, requirements: Object.values(fields), color,
    cad: {
      units: "mm", collar: pattern.collar, collarLabel: collarNames[pattern.collar],
      placketWidth: width, placketWidthMm: width, garmentLength: scene === "group" ? 690 : 720,
      shoulderWidth: scene === "group" ? 470 : 490, sleeveLength: scene === "group" ? 585 : 575,
      placketWidthSource: canApplyPlacket && width >= placketRequest.min && width <= placketRequest.max ? "已录入目标，模拟测点" : placketWidth != null ? "顾问设定的模拟测点" : "模拟基版",
      patternId: pattern.id, templateVersion: catalogVersion, source: "模拟基版",
    },
  };
}

const previewShades = {
  深藏蓝: "#25344e", 深蓝: "#334861", 深灰: "#454950", 灰色: "#77787c", 墨绿: "#304a3f",
  黑色: "#272827", 米白: "#e8e1d0", 白色: "#efeee8", 酒红: "#673640", 红色: "#8e4647",
  蓝色: "#496879", 粉色: "#ae7d88",
};
const shadeNames = {
  冷灰蓝: "#647888", 暖杏色: "#d2ad89", 驼色: "#a88868", 咖啡色: "#755b4b", 卡其色: "#ac9b73",
  炭灰: "#4a4b4c", 蓝灰: "#60798c", 雾紫灰: "#857e91", 紫色: "#755779", 浅紫: "#9c88a8",
  砖红: "#914f44", 朱砂红: "#92483e", 深棕色: "#59483b",
};

function sameShade(first, second) {
  return normalized(first) === normalized(second);
}

function shadeSatisfies(documented, requested) {
  return sameShade(documented, requested) || requested === "蓝色" && ["深藏蓝", "藏蓝", "深蓝", "蓝灰", "冷灰蓝"].includes(documented)
    || requested === "灰色" && ["深灰", "炭灰"].includes(documented);
}

function colorBrief(field, fabric, legacyColor) {
  const hasField = Boolean(field?.value && field.level !== "unspecified");
  const legacy = cleanText(legacyColor);
  const value = hasField ? field.value : !field?.value && !/未指定|示意色/.test(legacy) ? legacy : "";
  const known = detectVocabulary(value, "color", true);
  const excluded = [...new Set(known.filter(item => item.negated).map(item => item.value))];
  const changes = known.filter(item => !item.negated && item.value !== "撞色");
  const palette = { ...previewShades, ...shadeNames };
  const available = fabric?.colors?.filter(color => !excluded.some(item => shadeSatisfies(color, item))) ?? [];
  const exact = changes.find(item => available.some(color => shadeSatisfies(color, item.value)));
  const selected = exact ?? (!fabric?.colors?.length ? changes[0] : null);
  if (selected) {
    const inCatalog = available.find(color => shadeSatisfies(color, selected.value) && palette[color]);
    const display = inCatalog && !sameShade(inCatalog, selected.value) ? inCatalog : selected.value;
    return { value: display, status: field?.level === "required" ? "required" : "preferred", hex: palette[display], excluded,
      catalogEvidence: Boolean(exact), request: value, options: [...new Set(changes.map(item => item.value))] };
  }
  const documented = available.find(color => palette[color]);
  const sample = ["炭灰", "卡其色", "米白", "墨绿", "酒红"].find(color => !excluded.some(item => shadeSatisfies(color, item)));
  const fallback = documented ?? sample;
  return { value: fallback || "待确认", status: "pending", hex: palette[fallback] ?? null, excluded,
    catalogEvidence: Boolean(documented), request: value, options: [...new Set(changes.map(item => item.value))] };
}

function asBriefAsset(asset) {
  return asset ? { id: asset.id, name: asset.name, description: asset.description } : null;
}

function makeRenderPrompt({ key, title, layout, size, guidance, avoid, checks }, parameters, garment, reference) {
  const { version, style, environment, wearers, activity, dimensions, color, closure, collar, assets } = parameters;
  const [ratio, width, height] = size;
  const colorGuidance = color.status === "pending"
    ? "主色待确认，沟通图以" + color.value + "示意" + (color.request ? "，待核对的原色要求为「" + color.request + "」" : "")
    : "主色为" + color.value + (!color.catalogEvidence ? "，实物色卡待确认" : "") + (color.options.length > 1 ? "，仅呈现这一候选色，备选色另行沟通" : "");
  const detailPreference = parameters.designDetail ? "纹样或地域偏好「"+parameters.designDetail+"」，样布及具体设计待确认" : "";
  const construction = ["V" + version + " 同版服装", assets.pattern?.name, collar, assets.fabric?.name, assets.craft?.name, closure, colorGuidance, style ? "风格为" + style : "",detailPreference]
    .filter(Boolean).join("，");
  const sceneText = key === "on-body" ? [environment ? "场景为" + environment : "中性穿着场景，避免虚构具体地点", wearers ? "穿着人群为" + wearers : "", activity ? "动作参照" + activity : "自然站立"].filter(Boolean).join("，") : "";
  const referenceText = "同版结构、廓形和比例以技术平面图为参照。";
  const prompt = [construction, layout, guidance, sceneText, referenceText, "输出横纵比 " + ratio + "，目标画幅 " + width + "×" + height + " px。"].filter(Boolean);
  const avoidItems = [...new Set(["擅改领型、门襟、袖长比例或面料纹路", "未确认的图标、品牌、装饰和文字", "用渲染像素推断成衣毫米尺寸", ...avoid, ...color.excluded.map(item => "采用已排除的" + item)])];
  const text = prompt.map(part => part.replace(/[。；]+$/, "")).join("。") + "。避免" + avoidItems.join("、") + "。";
  const positive = [garment, layout, guidance, sceneText, colorGuidance, style ? "风格为" + style : "",detailPreference].filter(Boolean).join("，");
  return { key, title, ratio, width, height, layout, guidance, text, avoid: avoidItems, checks, profiles: {
    referenceImage: "使用「" + reference + "」作为图像参考，并粘贴完整提示词。第 " + version + " 版应与同版图纸和预览一致。",
    positive, negative: avoidItems.join("，"), midjourney: text + " --ar " + ratio,
  }, dimensionReference: { unit: dimensions.units, drawingId: parameters.drawingId } };
}

export function makeVisualBrief(solution, drawing) {
  if (!solution?.cad || !Array.isArray(solution.assets)) throw domainError("MISSING_SOLUTION", "请先生成一份带资产的版本方案。");
  const { scene, version, cad } = solution;
  const fields = fieldMap(solution.requirements);
  const assets = Object.fromEntries(["pattern", "fabric", "craft", "case"].map(type => [type, asBriefAsset(solution.assets.find(item => item.type === type))]));
  const [pattern, fabric, craft] = ["pattern", "fabric", "craft"].map(type => solution.assets.find(item => item.type === type));
  const measurements = drawing?.measurements ?? {};
  const request = Object.values(fields).filter(field => fitKeys.has(field.key) && field.value && field.level !== "unspecified");
  const facts = key => cleanText(fields[key]?.value);
  const color = colorBrief(fields.color, fabric, solution.color);
  const closure = measurements.placketClosure ?? ({ "TEC-001": "隐式门襟，暗扣不外露", "TEC-002": "外露手工一字盘扣", "TEC-009": "无扣开襟，一体式贴边" })[craft?.id] ?? "按同版门襟线表现，扣合方式待顾问确认";
  const parameters = {
    version, scene, drawingId: drawing?.id ?? null, catalogVersion: cad.templateVersion ?? catalogVersion,
    style: facts("style"), silhouette: facts("silhouette") || pattern?.description || "", collar: measurements.collar ?? cad.collarLabel ?? "沿用同版领型",
    closure, color, assets, environment: ["customer", "advisor"].includes(fields.scene.source) ? facts("scene") : "",
    wearers: facts("wearers"), activity: ["customer", "advisor"].includes(fields.activity.source) ? facts("activity") : "",
    care: fields.care.level !== "unspecified" ? facts("care") : "", designDetail:facts("designDetail"),
    dimensions: {
      units: "mm", source: "模拟基版，供参考图纸沟通", placketWidthMm: measurements.placketWidthMm ?? cad.placketWidth,
      garmentLengthMm: measurements.bodyLengthMm ?? cad.garmentLength, shoulderWidthMm: measurements.shoulderWidthMm ?? cad.shoulderWidth,
      sleeveLengthMm: measurements.sleeveLengthMm ?? cad.sleeveLength, collarWidthMm: measurements.collarWidthMm ?? null,
      shoulderDropMm: measurements.shoulderDropMm ?? null, shoulderOffsetMm: measurements.shoulderOffsetMm ?? null,
      placketWidthSource: cad.placketWidthSource ?? "模拟基版",
      ...(measurements.placketWidthDatum ? { placketWidthDatum: measurements.placketWidthDatum } : {}),
      requested: request.map(({ key, label, value, level, source }) => ({ key, label, value, level, source })),
    },
  };
  const constructionFocus = {
    "TEC-009": ["近拍前中无扣开襟和一体式贴边，轻轻翻出一小段边口，侧光呈现低对比暗纹", "前中略掩合，贴边与衣身连裁，局部无扣件"],
    "TEC-004": ["对准夹克口袋开口与袋口端点，用柔和侧光呈现低可见度同色加固和斜向或细密布纹", "能看清实际袋口端点的加固位置"],
    "TEC-007": ["局部展示腋下、袖窿与衣身的连接，在轻微抬臂时拍摄接合处", "袖根与衣身的活动结构清晰"],
    "TEC-006": ["近拍驳头边缘和翻折线，柔和侧光呈现低对比压线", "同色压线沿翻驳领边缘分布"],
    "TEC-008": ["近拍袖口或下摆的薄料收边和细小手针，保留布料正反面关系", "收边位置和薄料叠层清楚"],
    "TEC-005": ["近拍同色绣线及底布，使用无企业标识的模拟纹样", "绣线与底布的低对比关系清楚"],
  }[craft?.id];
  const configs = [
    { key: "garment", title: "成衣正背面", size: ["3:2", 1500, 1000], layout: "以同一尺度并排展示同一件成衣的完整正视和背视",
      guidance: "使用中性棚拍背景和一致的光源，保留肩线、下摆、领口和袖口，不裁切轮廓", avoid: ["正背两侧使用不同的领型或色卡", "遮挡下摆和袖口"],
      checks: ["同件服装的前后外轮廓及用料一致", "保持「" + parameters.collar + "」和同版门襟线", "两视图完整且比例一致"] },
    { key: "detail", title: "工艺与材质特写", size: ["1:1", 1200, 1200], layout: constructionFocus?.[0] ?? "从领口到门襟取局部近景，用柔和侧光呈现面料纹理与所选工艺",
      guidance: "纹理参照「" + (fabric?.name ?? "同版用料") + "」，工艺参照「" + (craft?.name ?? "同版工艺") + "」的实际位置" + (constructionFocus ? "" : "；门襟参照约 " + parameters.dimensions.placketWidthMm + " mm 的模拟图纸几何"), avoid: ["虚构额外扣件、装饰或明显不同的织纹", "把像素当成尺寸标注"],
      checks: [constructionFocus?.[1] ?? "局部闭合结构符合「" + closure + "」", "纹理与所选面料一致", "工艺位置清楚且保留上下文"] },
    { key: "on-body", title: "上身与场景氛围", size: ["4:5", 1200, 1500], layout: "在已确认场景中以全身构图表现穿着者，人物动作和背景保留视线焦点",
      guidance: "展示衣身舒展和关键活动区域，保留完整袖口、下摆与领线。场景不详时用中性背景", avoid: ["添加未确认的具体地点、真人肖像或单位标识", "用姿态遮住肩点、门襟和侧身轮廓"],
      checks: ["场景符合「" + (parameters.environment || "通用场景，待确认") + "」", "活动姿态对应用户使用需求", "衣身及动作完整入画"] },
  ];
  if (craft?.id === "TEC-009") {
    const neckline = cad.collar === "cross" ? "窄长 V 口沿前中微斜直开，襟缘轻掩" : "低立领下沿前中直开，襟缘轻掩";
    for (const config of configs) {
      config.guidance += "。结构依照" + neckline + "、直筒袖口与带挡布的两侧下摆开衩";
      config.avoid.push("加装明扣、暗扣、拉链、盘扣或侧系带", "改成横贯胸腹的深交叠");
    }
  }
  const garment = [pattern?.name, fabric?.name, craft?.name, parameters.collar, closure, parameters.silhouette].filter(Boolean).join("，");
  const prompts = configs.map(config => makeRenderPrompt(config, parameters, garment, parameters.drawingId ?? "同版款式技术平面图"));
  return { solutionId: solution.id, version, parameters, prompts, description: "三组视觉需求引用 V" + version + " 参数、资产编号和技术图。" };
}

export function suggestCaseNote(scene) {
  return normalizeScene(scene) === "group"
    ? "职业服方案核对机洗、洗后牢度、试穿活动及补货批次色差。"
    : "宽肩背外套需核对肩背松量，并安排抬臂试穿。";
}
