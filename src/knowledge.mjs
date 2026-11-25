const verifiedOn = '2026-11-25';
const standardsPublisher = '国家市场监督管理总局标准信息平台';
const openStandard = code => 'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=' + code;
const standardRecord = code => 'https://std.samr.gov.cn/gb/search/gbDetailed?id=' + code;

// Public sources describe methods or a named heritage project. Guidance is how a
// specialist can apply that reference to a mock case, without assigning it a test result.
export const knowledgeSources = [
  {
    id: 'body-measurement', title: '区分人体量体值和基版尺寸',
    sourceTitle: 'GB/T 16160-2017《服装用人体测量的尺寸定义与方法》',
    sourceUrl: openStandard('E703AB1DBE97906BF685F391700AC9E1'),
    guidance: '顾问记录实际量体的部位、数值和单位。客户只说肩背宽时，保留原话，肩宽数值待实测。',
    scope: '人体测量记录；衣身松量由版师结合款式和试穿另行确认。',
  },
  {
    id: 'garment-measurement', title: '用样衣复测图纸尺寸',
    sourceTitle: 'GB/T 31907-2015《服装测量方法》',
    sourceUrl: openStandard('BB13897B1F97D1C006926271FD9DF237'),
    successor: { standard:'GB/T 31907-2025', effectiveOn:'2027-03-01', url:openStandard('3C417D33DBFE80B0D7F9F9EF72F9317E') },
    guidance: '记录本版图纸号、部位、测量起止点和单位。在对应样衣上复测衣长、肩宽与袖长，将实测值和偏差单独登记。',
    scope: '成衣实测方法。图纸已有毫米数，样衣实测值和允许偏差仍需确认。',
  },
  {
    id: 'wearer-trial', title: '把活动需求带到试穿',
    sourceTitle: 'GB/T 31901-2015《服装穿着试验及评价方法》',
    sourceUrl: openStandard('07BE01C6DAD5C45671A5C11BE5982D06'),
    successor: { standard:'GB/T 31901-2024', effectiveOn:'2026-12-01', url:openStandard('562D27324D9D8C88C81913C080B4E5FC') },
    guidance: '按客户提出的实际动作安排试穿。记录样衣版本、动作、穿着者感受和受牵扯的部位，修订后用同一动作复核。',
    scope: '实际穿着评价；动作和记录项是本案的试穿建议。',
  },
  {
    id: 'fiber-content', title: '核实所选面料的纤维成分',
    sourceTitle: 'GB/T 29862-2013《纺织品 纤维含量的标识》',
    sourceUrl: openStandard('78E12DC297A27F3AB95C25986FD71586'),
    successor: { standard:'GB/T 29862-2026', effectiveOn:'2027-08-01', url:openStandard('DAC86C84C075CD922C91EE25F66985DA') },
    guidance: '对照对应批次的成分资料，核对纤维名称与含量。资料只写“混纺”时，保留含量待核；客户禁用某种纤维时，须另有成分证据才能放行。',
    scope: '纤维含量标识；具体批次需实物资料或检测报告。',
  },
  {
    id: 'care-label', title: '核对整件样衣的护理方式',
    sourceTitle: 'GB/T 8685-2008《纺织品 维护标签规范 符号法》',
    sourceUrl: openStandard('71C2A3A4A87C53BFFE366DF7778E6C7E'),
    guidance: '把客户的护理要求、面料卡允许的护理方式、成衣拟用的维护标识分开记录。请业务人员结合面料、辅料与样衣验证后确认标识。',
    scope: '维护标签的表述；具体温度、程序和整衣护理可行性待样衣验证。',
  },
  {
    id: 'wash-dimensions', title: '比较洗前与洗后的尺寸',
    sourceTitle: 'GB/T 8630-2013《纺织品 洗涤和干燥后尺寸变化的测定》',
    sourceUrl: standardRecord('71F772D7F823D3A7E05397BE0A0AB82A'),
    guidance: '约定实际洗涤、干燥条件和样衣测量点。把洗前、洗后数值及条件记在同一张记录中，交由业务人员核对。',
    scope: '洗涤和干燥后的尺寸变化；合格限值由适用产品要求及双方约定确定。',
  },
  {
    id: 'wash-colour', title: '核实耐洗色牢度',
    sourceTitle: 'GB/T 12490-2014《纺织品 色牢度试验 耐家庭和商业洗涤色牢度》',
    sourceUrl: standardRecord('71F772D7F9DDD3A7E05397BE0A0AB82A'),
    guidance: '确认客户实际送洗方式，再向检测方取得相应条件下的变色和沾色结果。酒店采用工业洗涤时，另由检测方确认相应方法。',
    scope: '家庭和商业洗涤条件下的色牢度。护理等级与可接受结果均需另行确认。',
  },
  {
    id: 'repeat-dye-lot', title: '把补货批次与留样对色',
    sourceTitle: 'GB/T 8424.1-2001《纺织品 色牢度试验 表面颜色的测定通则》',
    sourceUrl: standardRecord('71F772D7849BD3A7E05397BE0A0AB82A'),
    guidance: '保留客户确认的实物色样、批次号和对色条件。补货时调出同一留样比较新批次，记录结果及确认人。',
    scope: '纺织品表面颜色测量。留样、批次对照是本案建议的交接步骤，色差限值另行约定。',
  },
  {
    id: 'shanghai-frog-button', title: '核对盘扣工艺的出处',
    publisher: '上海市人民政府',
    sourceTitle: '第二批上海市非物质文化遗产名录，中式服装盘扣制作技艺（VIII-42，徐汇区）',
    sourceUrl: 'https://www.shanghai.gov.cn/nw23216/20200820/0001-23216_19050.html',
    guidance: '本单工艺写作“手工一字盘扣”。如拟对外引用特定非遗项目，请另核项目、制作者及授权材料。',
    scope: '市级名录中有此特定项目；当前模拟资产只记录工艺名称。',
  },
].map(source => ({publisher:standardsPublisher, verifiedOn, ...source}));

export function referenceChecksFor(solution) {
  if (!solution?.selected?.pattern || !solution.selected.fabric) return [];
  const fields = new Map((Array.isArray(solution.requirements) ? solution.requirements : []).map(field => [field.key, field]));
  const ids = new Set(['body-measurement', 'garment-measurement', 'fiber-content', 'care-label']);
  const activity = fields.get('activity');
  if (activity?.value && ['customer','advisor'].includes(activity.source)) ids.add('wearer-trial');
  const care = fields.get('care');
  const selectedFabric = solution.assets?.find(asset => asset.type === 'fabric' && asset.id === solution.selected.fabric);
  const washingRequested = care?.codes?.includes('machine') || care?.codes?.includes('hand');
  const washByCard = ['machine','hand'].includes(selectedFabric?.care) && !care?.excluded?.includes(selectedFabric.care);
  if (washingRequested || (!care?.codes?.length && washByCard)) {
    ids.add('wash-dimensions');
    ids.add('wash-colour');
  }
  if (fields.get('replenishment')?.value === '需要后续补货') ids.add('repeat-dye-lot');
  if (solution.selected.craft === 'TEC-002') ids.add('shanghai-frog-button');
  return knowledgeSources.filter(source => ids.has(source.id));
}
