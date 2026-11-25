import { strToU8, zipSync } from 'fflate';
import { patternReviewState } from './pattern-review.mjs';

const SCOPE = '模拟款式技术图，供沟通与版师复核';
const DRAWING_WIDTH = 2100;
const DRAWING_HEIGHT = 1175;
const PLACKET_OFFSET = 22;
const LAYERS = {
  OUTLINE: { color: 7, ink: '#25394b', width: 4 },
  STRUCTURE: { color: 5, ink: '#485f71', width: 2.4 },
  CRAFT: { color: 8, ink: '#6a7888', width: 1.5, dash: '8 6' },
  DIMENSIONS: { color: 4, ink: '#006b64', width: 2 },
  CALIBRATION: { color: 3, ink: '#006b64', width: 2 },
  NOTES: { color: 7, ink: '#435969', width: 1 }
};

const XML_CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g;
const XML_UNPAIRED_SURROGATES = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

function xml(value) {
  return String(value ?? '')
    .replace(XML_CONTROL_CHARS, '')
    .replace(XML_UNPAIRED_SURROGATES, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const px = value => Number(Number(value).toFixed(6));

function bezier(start, control1, control2, end, count = 12) {
  return Array.from({ length: count }, (_, step) => {
    const t = (step + 1) / count;
    const s = 1 - t;
    return [0, 1].map(
      axis => px(s ** 3 * start[axis] + 3 * s ** 2 * t * control1[axis]
        + 3 * s * t ** 2 * control2[axis] + t ** 3 * end[axis])
    );
  });
}

function addLine(items, layer, from, to, properties = {}) {
  items.push({ type: 'line', layer, from, to, ...properties });
}

function addPath(items, layer, points, closed = false) {
  items.push({ type: 'path', layer, points, closed });
}

function addText(items, layer, position, svgText, cadText, size, properties = {}) {
  items.push({ type: 'text', layer, position, svgText, cadText, size, ...properties });
}

function collarType(cadCollar, group) {
  const raw = String(cadCollar ?? '').trim().toLowerCase();
  if (/low[\s_-]*stand|low[\s_-]*mandarin|mandarin|低立领|小立领/.test(raw)) return 'low_stand';
  if (/^(?:stand|stand[\s_-]*collar)$|立领/.test(raw)) return 'stand';
  if (/cross|wrap|crossed|斜领|斜襟|交领/.test(raw)) return 'cross';
  if (/shirt|lapel|西装|驳领|翻领|衬衫领/.test(raw)) return 'turn';
  if (/round|crew|圆领/.test(raw)) return 'round';
  if (raw) return 'unknown';
  return group ? 'low_stand' : 'cross';
}

const COLLAR_LABELS = {
  cross: { zh: '交领开襟', en: 'Cross collar' },
  low_stand: { zh: '低立领', en: 'Low stand collar' },
  stand: { zh: '立领', en: 'Stand collar' },
  turn: { zh: '翻驳领', en: 'Turn collar' },
  round: { zh: '圆领', en: 'Round collar' },
  unknown: { zh: '领型待核', en: 'Collar to verify' }
};

const COLLAR_WIDTH_DATUM = '正视图左、右领肩接点的水平距离';
const SHOULDER_DATUM = '从同侧领肩点水平基准垂直量至袖根肩点，横向位置量自前中线';
const BODY_LENGTH_DATUM = '领肩接点水平线至下摆中心的垂距，不含立领高度';
const SHOULDER_WIDTH_DATUM = '正视图两侧袖根肩点之间的水平距离';
const SLEEVE_LENGTH_DATUM = '正视图袖根肩点至袖口中点的直线距离';
const PLACKET_CLOSURES = {
  open: { zh: '无扣开襟，一体式贴边', en: 'Buttonless cut-on facing' },
  concealed: { zh: '暗扣藏于门襟搭接内', en: 'Concealed fastening' },
  frog: { zh: '外露一字盘扣示意', en: 'Exposed frog fastening' },
  double: { zh: '双排扣位置示意', en: 'Double button row' },
  pending: { zh: '闭合细节由版师确认', en: 'Fastening for review' }
};

function placketFor(solution, collar) {
  const craft = solution?.selected?.craft ?? solution?.assets?.find(item => item.type === 'craft')?.id;
  const pattern = solution?.cad?.patternId ?? solution?.selected?.pattern;
  if (craft === 'TEC-009') {
    const style = collar === 'cross' ? { zh: '交领前中微斜直开，浅掩合', en: 'Slightly angled buttonless opening' }
      : { zh: '低立领前中直开，浅掩合', en: 'Straight buttonless opening' };
    return { style, closure: 'open' };
  }
  const closure = craft === 'TEC-001' ? 'concealed' : craft === 'TEC-002' ? 'frog' : pattern === 'PAT-008' ? 'double' : 'pending';
  const style = collar === 'cross'
    ? { zh: '交领斜接门襟搭接', en: 'Cross-lapped placket' }
    : { zh: '前中直门襟搭接', en: 'Centre-front overlap' };
  return { style, closure };
}

function drawFastening(items, centre, y, closure) {
  const [x, height] = centre;
  const offsetY = height + y;
  if (closure === 'concealed') {
    addLine(items, 'CRAFT', [x - 6, offsetY], [x - 2, offsetY], { hidden: true });
    addLine(items, 'CRAFT', [x + 2, offsetY], [x + 6, offsetY], { hidden: true });
  } else if (closure === 'frog') {
    addPath(items, 'CRAFT', [[x - 29, offsetY], [x - 23, offsetY - 4], [x - 17, offsetY], [x - 23, offsetY + 4], [x - 29, offsetY]]);
    addLine(items, 'STRUCTURE', [x - 17, offsetY], [x + 26, offsetY]);
  } else if (closure === 'double') {
    for (const sign of [-1, 1]) {
      const buttonX = x + sign * 36;
      addPath(items, 'STRUCTURE', [[buttonX - 5, offsetY], [buttonX, offsetY - 5], [buttonX + 5, offsetY], [buttonX, offsetY + 5], [buttonX - 5, offsetY]]);
    }
  }
}

function drawFlat(items, { origin, group, back, collar, widthMm, dimensions, closure, pattern, craft }) {
  const length = group ? 600 : 655;
  const shoulder = group ? 157 : 174;
  const scaleX = dimensions.shoulderWidthMm / (2 * shoulder);
  const scaleY = dimensions.bodyLengthMm / length;
  const at = ([x, y]) => [px(origin[0] + scaleX * x), px(origin[1] + scaleY * y)];
  const mirror = ([x, y]) => [-x, y];
  const path = (layer, points, closed) => addPath(items, layer, points.map(at), closed);
  const line = (layer, a, b) => addLine(items, layer, at(a), at(b));
  const neck = group ? 54 : 56;
  const fitted = pattern === 'PAT-008';
  const concierge = pattern === 'PAT-004' && collar === 'turn';
  const loose = pattern === 'PAT-007';
  const body = (group ? 144 : 153) + (loose ? 9 : 0);
  const hemTip = group ? 20 : 30;
  const openFacing = closure === 'open';
  const neckY = collar === 'round' && !back ? 58 : back || collar === 'low_stand' || collar === 'stand' ? 14 : 26;
  const neckRight = [neck, 0];
  const shoulderEnd = [shoulder, 34];
  const underarm = [body - 9, 206];
  const sleeveStretch = dimensions.sleeveLengthMm / Math.hypot(69 * scaleX, 500 * scaleY);
  const cuff = [shoulder + 69 * sleeveStretch, 34 + 500 * sleeveStretch];
  const cuffHalfWidth = loose ? 44 : 34;
  const outerCuff = [cuff[0] + cuffHalfWidth, cuff[1] - 11];
  const innerCuff = [cuff[0] - cuffHalfWidth, cuff[1] + 11];
  const standEdge = collar === 'stand' ? -48 : -33;

  const rightSide = [
    neckRight,
    ...bezier(neckRight, [94, 3], [shoulder - 18, 22], shoulderEnd),
    ...bezier(shoulderEnd, [shoulder + 35, 63], [shoulder + 45, 136], [shoulder + 61, 213]),
    outerCuff, cuff, innerCuff,
    ...bezier(innerCuff, [innerCuff[0] - 18, innerCuff[1] - 94], [body + 4, 294], underarm),
    ...(fitted ? [[body - 25, length * .57], [body - 12, length * .78]] : []),
    ...(openFacing ? [[body, length - 63], [body + 1, length - 8], [body - 5, length - 8], [body - 6, length]]
      : [[body, length - hemTip], ...bezier([body, length - hemTip], [body + 3, length - 8], [body - 1, length], [body - 20, length], 6)])
  ];
  const leftNeck = mirror(neckRight);
  const stand = collar === 'low_stand' || collar === 'stand';
  const raisedBack = (collar === 'turn' || openFacing && collar === 'cross') && back;
  const frontV = openFacing && collar === 'cross' && !back
    ? [leftNeck, ...bezier(leftNeck, [-35,47], [-14,141], [-2,193]), ...bezier([-2,193], [10,135], [39,43], neckRight)] : null;
  const neckProfile = stand
    ? [[-neck - 1, standEdge], [-31, standEdge + 8], ...(openFacing && !back ? [[-5,standEdge+10],[0,5],[5,standEdge+10]] : [[0,standEdge+10]]), [31, standEdge + 8], [neck + 1, standEdge], neckRight]
    : raisedBack
      ? [[-neck + 4, -18], [-28, -11], [0, -9], [28, -11], [neck - 4, -18], neckRight]
      : frontV
        ? [[-neck+9,-14], [-31,-20], [31,-20], [neck-9,-14], neckRight]
        : bezier(leftNeck, [-25, neckY], [25, neckY], neckRight);
  path('OUTLINE', [
    leftNeck, ...neckProfile, ...rightSide.slice(1), [0, length],
    ...rightSide.map(mirror).reverse().slice(0, -1)
  ], true);

  for (const sign of [-1, 1]) {
    const side = ([x, y]) => [sign * x, y];
    path('STRUCTURE', [
      shoulderEnd, ...bezier(shoulderEnd, [shoulder - 15, 92], [body + 4, 150], underarm)
    ].map(side));
    line('CRAFT', side([innerCuff[0] + 3, innerCuff[1] - 20]), side([outerCuff[0] - 3, outerCuff[1] - 18]));
    if (openFacing) {
      path('STRUCTURE', [[body - 9, 222], [body - 5, length - 63], [body - 6, length]].map(side));
      const backing = [[body - 5, length - 63], [body - 18, length - 63], [body - 18, length - 3], [body - 6, length - 3]];
      for (let i = 1; i < backing.length; i++) addLine(items, 'CRAFT', at(side(backing[i-1])), at(side(backing[i])), { hidden:true });
    } else {
      path('STRUCTURE', [[body - 9, 222], ...(fitted ? [[body - 39, length * .58]] : []), [body - 16, length - 23]].map(side));
    }
    if (craft === 'TEC-007') {
      path('CRAFT', [underarm, [body + 18, 218], [body + 8, 254], [body - 3, 244], underarm].map(side));
    }
  }
  path('CRAFT', [
    [-body + 9, length - 33], [-body + 16, length - 17], [body - 16, length - 17], [body - 9, length - 33]
  ]);

  if (stand || raisedBack) {
    path('STRUCTURE', [leftNeck, ...bezier(leftNeck, [-25, neckY], [25, neckY], neckRight)]);
  }
  if (frontV) {
    path('STRUCTURE', frontV);
    path('STRUCTURE', [[-neck+9,-14], ...bezier([-neck+9,-14],[-29,47],[-12,123],[-2,180]), ...bezier([-2,180],[10,123],[29,47],[neck-9,-14])]);
  } else if (stand && !(openFacing && !back)) {
    path('CRAFT', [
      [-neck + 5, standEdge + 8], [-31, standEdge + 14], [0, standEdge + 16],
      [31, standEdge + 14], [neck - 5, standEdge + 8]
    ]);
  } else if (concierge && !back) {
    // A notched blazer has a long lapel break. Stop the underlap where it meets
    // the upper panel so the finished front does not acquire a shirt collar.
    const breakX = -widthMm / (2 * scaleX);
    path('STRUCTURE', [[-neck, 0], [-76, 58], [-54, 56], [-73, 78], [-13, 193]]);
    path('STRUCTURE', [[neck, 0], [76, 58], [54, 56], [73, 78], [breakX, 270]]);
    path('STRUCTURE', [[-neck, 0], [0, 145], [neck, 0]]);
    path('STRUCTURE', [[0, 145], [-13, 193], [breakX, 270]]);
    if (craft === 'TEC-006') {
      path('CRAFT', [[71, 56], [50, 54], [68, 78], [breakX + 3, 261]]);
      path('CRAFT', [[-71, 56], [-50, 54], [-68, 78], [-13, 188]]);
    }
  } else if (collar === 'turn' && !back) {
    path('STRUCTURE', [[-neck, 0], [-neck - 18, 19], [-29, 76], [0, 43], [29, 76], [neck + 18, 19], [neck, 0]]);
    if (craft === 'TEC-006') path('CRAFT', [[-neck - 13, 21], [-28, 69], [0, 38], [28, 69], [neck + 13, 21]]);
  } else if (collar === 'round') {
    const left = [-neck + 4, 10];
    path('STRUCTURE', [left, ...bezier(left, [-24, neckY + 15], [24, neckY + 15], [neck - 4, 10])]);
  } else if (collar === 'cross' && !openFacing) {
    path('STRUCTURE', [[-neck, 1], [-40, 19], [-18, 25], [0, 28], [18, 25], [40, 19], [neck, 1]]);
  }

  const landmarks = {
    neckLeft: at(leftNeck), neckRight: at(neckRight),
    shoulder: at(shoulderEnd), shoulderLeft: at(mirror(shoulderEnd)),
    centreX: origin[0], bodyLength: [at([0, 0]), at([0, length])],
    sleeveLength: [at(mirror(shoulderEnd)), at(mirror(cuff))],
    ...(frontV ? {insideNeck:[...frontV, ...neckProfile.slice(0,-1).reverse()].map(at)} : {}),
  };
  if (back) {
    line('STRUCTURE', [0, openFacing ? 11 : 43], [0, length - 20]);
    if (group && !concierge) path('CRAFT', [[-body + 9, 108], [-79, 121], [0, 129], [79, 121], [body - 9, 108]]);
    return landmarks;
  }
  const placket = widthMm / scaleX;
  const leftEdge = openFacing ? -2 : collar === 'cross' ? PLACKET_OFFSET / scaleX : -placket / 2;
  const rightEdge = leftEdge + placket;
  if (openFacing) {
    const openingTop = stand ? [0, 5] : [-2, 193];
    path('STRUCTURE', [openingTop, [leftEdge, 201], [leftEdge - (stand ? 0 : 4), length]]);
    for (const sign of [-1, 1]) {
      const facingTop = stand ? [sign * placket, 13] : [sign * (neck + 9), 4];
      const facingHem = sign === 1 ? rightEdge : leftEdge - placket;
      const points = [facingTop, ...bezier(facingTop, [sign * (stand ? placket : 45), 63], [facingHem, 156], [facingHem,201]), [facingHem - (stand ? 0 : 4),length-3]];
      for (let i = 1; i < points.length; i++) addLine(items,'CRAFT',at(points[i-1]),at(points[i]),{hidden:true});
    }
  } else if (collar === 'cross') {
    path('STRUCTURE', [[-40, 19], ...bezier([-40, 19], [-32, 61], [25, 107], [rightEdge, 168]), [rightEdge, length - 19]]);
    path('STRUCTURE', [[40, 19], ...bezier([40, 19], [41, 83], [20, 111], [leftEdge, 168]), [leftEdge, length - 19]]);
  } else if (concierge) {
    path('STRUCTURE', [[leftEdge, 270], [leftEdge, length]]);
    addLine(items, 'CRAFT', at([rightEdge, 280]), at([rightEdge, length - 19]), {hidden:true});
  } else {
    const placketTop = collar === 'round' ? neckY : collar === 'unknown' ? neckY + 5 : collar === 'turn' ? 63 : -22;
    path('STRUCTURE', [[leftEdge, placketTop], [leftEdge, length - 19]]);
    path('STRUCTURE', [[rightEdge, placketTop], [rightEdge, length - 19]]);
  }

  if (concierge) {
    for (const sign of [-1, 1]) {
      const inner = sign * 55, outer = sign * 121;
      path('STRUCTURE', [[inner, 398], [outer, 394], [outer, 404], [inner, 408]], true);
      line('STRUCTURE', [inner, 403], [outer, 399]);
      if (craft === 'TEC-004') {
        line('CRAFT', [inner, 397], [inner, 409]);
        line('CRAFT', [outer, 393], [outer, 405]);
      }
    }
  } else if (group) {
    for (const sign of [-1, 1]) {
      const endpoint = sign * 110;
      const start = sign * 65;
      line('STRUCTURE', [start, 404], [endpoint, 380]);
      line('CRAFT', [start, 420], [endpoint, 395]);
      if (craft === 'TEC-004') {
        line('CRAFT', [start, 399], [start, 409]);
        line('CRAFT', [endpoint, 375], [endpoint, 385]);
      }
    }
  }
  const placketCenter = at([(leftEdge + rightEdge) / 2, 164]);
  for (const y of [49, 111, 173]) drawFastening(items, placketCenter, y, closure);
  return {
    ...landmarks,
    placket: [at([leftEdge, concierge ? 326 : 201]), at([rightEdge, concierge ? 326 : 201])],
    craftFocus: craft === 'TEC-004' && group ? at([88, 397])
      : craft === 'TEC-007' ? at([body + 5, 228])
        : craft === 'TEC-008' ? at([0, length - 19]) : placketCenter,
  };
}

function garmentView(options) {
  const entities = [];
  const landmarks = drawFlat(entities, options);
  const points = entities.flatMap(item => item.points ?? [item.from, item.to]);
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return { entities, landmarks, bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

function createGeometry(solution) {
  const group = solution?.scene === 'group';
  const data = solution?.cad ?? {};
  const widthMm = Number(data.placketWidth ?? data.placketWidthMm ?? 30);
  if (!Number.isFinite(widthMm) || widthMm < 20 || widthMm > 50) {
    throw new RangeError('门襟宽须在 20 至 50 mm 之间');
  }
  const size = (value, fallback, min, max, name) => {
    const result = Number(value ?? fallback);
    if (!Number.isFinite(result) || result < min || result > max) {
      throw new RangeError(name + '超出模拟基版范围');
    }
    return result;
  };
  const dimensions = {
    bodyLengthMm: size(data.garmentLength, group ? 690 : 720, 570, 800, '衣长'),
    shoulderWidthMm: size(data.shoulderWidth, group ? 470 : 490, 360, 520, '肩宽'),
    sleeveLengthMm: size(data.sleeveLength, group ? 585 : 575, 480, 640, '袖长')
  };
  const collar = collarType(data.collar, group);
  const placket = placketFor(solution, collar);
  const flat = { group, collar, widthMm, dimensions, closure: placket.closure,
    pattern: data.patternId ?? solution?.selected?.pattern, craft: solution?.selected?.craft };
  const frontView = garmentView({ origin: [470, 280], ...flat });
  const backView = garmentView({ origin: [1360, 280], ...flat, back: true });
  const front = frontView.landmarks;
  const entities = [...frontView.entities, ...backView.entities];

  addText(entities, 'NOTES', [470, 1130], '正视图', 'FRONT', 25, { anchor: 'middle' });
  addText(entities, 'NOTES', [1360, 1130], '背视图', 'BACK', 25, { anchor: 'middle' });
  addText(entities, 'NOTES', [1820, 224], '门襟结构', 'PLACKET DETAIL', 26, { bold: true });
  addText(entities, 'NOTES', [1820, 252], placket.style.zh, placket.style.en, 19);
  const fastening = PLACKET_CLOSURES[placket.closure];
  addText(entities, 'NOTES', [1820, 277], fastening.zh, fastening.en, 17);
  const detailFrom = [1880, 464];
  const detailTo = [px(1880 + widthMm), 464];
  for (const x of [detailFrom[0], detailTo[0]]) {
    const insideFacing = placket.closure === 'open' && x === detailTo[0];
    addLine(entities, insideFacing ? 'CRAFT' : 'STRUCTURE', [x, 331], [x, 480], {hidden:insideFacing});
  }
  drawFastening(entities, [(detailFrom[0] + detailTo[0]) / 2, 331], 72, placket.closure);
  const [leftPlacket, rightPlacket] = front.placket;
  addLine(entities, 'DIMENSIONS', leftPlacket, rightPlacket);
  addText(entities, 'DIMENSIONS', [rightPlacket[0] + 13, rightPlacket[1] + 5], 'C', 'C', 17);

  const shoulderFrom = [front.shoulder[0], front.neckRight[1]];
  addLine(entities, 'CRAFT', front.neckRight, shoulderFrom);
  const collarWidth = { mark: 'A', axis: 'x', from: front.neckLeft, to: front.neckRight, offset: 226 };
  const shoulderDrop = { mark: 'B', axis: 'y', from: shoulderFrom, to: front.shoulder, offset: 786 };
  const placketWidth = { mark: 'C', axis: 'x', from: detailFrom, to: detailTo, offset: 528 };
  const [bodyFrom, bodyTo] = front.bodyLength;
  const midGap = px((frontView.bounds[2] + backView.bounds[0]) / 2);
  const bodyLength = { mark: 'D', axis: 'y', from: bodyFrom, to: bodyTo, offset: midGap, labelOffset: -54 };
  const shoulderWidth = { mark: 'E', axis: 'x', from: front.shoulderLeft, to: front.shoulder, offset: 190 };
  const [sleeveFrom, sleeveTo] = front.sleeveLength;
  const sleeveLength = { mark: 'F', axis: 'aligned', from: sleeveFrom, to: sleeveTo, offset: -68 };
  const shoulderOffsetMm = px(front.shoulder[0] - front.centreX);
  addText(entities, 'NOTES', [1820, 590], '测点基准', 'MEASUREMENT DATUMS', 22, { bold: true });
  addText(entities, 'NOTES', [1820, 620], 'A 领宽（领肩接点水平距）', 'A COLLAR JOIN SPAN', 18);
  addText(entities, 'NOTES', [1820, 646], 'B 落肩垂距（高肩基准）', 'B SHOULDER VERTICAL DROP', 18);
  addText(entities, 'NOTES', [1820, 672], '肩点距前中线 ' + shoulderOffsetMm + ' mm', 'SEAM X OFFSET ' + shoulderOffsetMm + ' mm', 16);
  addText(entities, 'NOTES', [1820, 698], placket.closure === 'open' ? 'C 襟缘至贴边内口示意宽' : 'C 门襟搭接双边线间距', placket.closure === 'open' ? 'C OPENING EDGE TO FACING' : 'C PLACKET EDGE DISTANCE', 18);
  addText(entities, 'NOTES', [1820, 724], 'D 衣长（高肩线至下摆）', 'D HIGH SHOULDER TO HEM', 18);
  addText(entities, 'NOTES', [1820, 750], 'E 肩宽（两侧袖根肩点）', 'E SHOULDER SEAM SPAN', 18);
  addText(entities, 'NOTES', [1820, 776], 'F 袖长（肩点至袖口中点）', 'F SHOULDER TO CUFF CENTRE', 17);
  if (placket.closure === 'open') {
    addText(entities, 'NOTES', [1820, 803], '直筒袖口，侧衩内设挡布', 'STRAIGHT CUFF / BACKED SIDE VENTS', 15);
    addText(entities, 'NOTES', [1820, 827], '工艺参考：模拟开襟、贴边和侧衩', 'SIMULATED CONSTRUCTION DETAILS', 14);
  }
  const rulerFrom = [1840, 858];
  const rulerTo = [1940, 858];
  addLine(entities, 'CALIBRATION', rulerFrom, rulerTo);
  for (const x of [1840, 1865, 1890, 1915, 1940]) {
    addLine(entities, 'CALIBRATION', [x, 847], [x, 868]);
  }
  addText(entities, 'NOTES', [1820, 901], '100 mm 校尺', '100 mm SCALE', 23);
  addText(entities, 'NOTES', [50, 62], String(solution?.title || '海派定制参考款式').slice(0, 42), 'PLANTO / SIMULATED GARMENT FLAT', 31, { bold: true });
  const revision = String(solution?.version ?? 1).replace(/^v/i, '').replace(/[^0-9.]/g, '').slice(0, 10) || '1';
  addText(entities, 'NOTES', [50, 104], '技术图 V' + revision + ' / 毫米 / ' + COLLAR_LABELS[collar].zh, 'V' + revision + ' | mm | ' + COLLAR_LABELS[collar].en, 20);
  addText(entities, 'NOTES', [50, 140], SCOPE, 'SIMULATED REFERENCE - NOT A CUTTING PATTERN', 18);

  return {
    entities, collar, revision, collarWidth, shoulderDrop, placketWidth, bodyLength, shoulderWidth, sleeveLength,
    placket, shoulderOffsetMm, frontPlacket: front.placket,
    views: { front: frontView, back: backView }
  };
}

export function getDrawingSilhouettes(solution) {
  return createGeometry(solution).views;
}

export function exportDrawingModel(solution) {
  const geometry = createGeometry(solution);
  const dimensions = dimensionFields.map(key => geometry[key]);
  return {width:DRAWING_WIDTH, height:DRAWING_HEIGHT, layers:LAYERS, revision:geometry.revision,
    entities:geometry.entities, dimensions:dimensions.map(d => ({...d,...dimensionLayout(d)})),
    dimensionGraphics:dimensions.flatMap(dimensionGraphics), frontPlacket:geometry.frontPlacket};
}

function distance({ from, to }) {
  return px(Math.hypot(to[0] - from[0], to[1] - from[1]));
}

function dimensionLayout({ from, to, offset, axis, labelOffset = 64 }) {
  if (axis === 'aligned') {
    const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
    const length = Math.hypot(dx, dy);
    const shifted = (point, gap) => [px(point[0] + dy / length * gap), px(point[1] - dx / length * gap)];
    const start = shifted(from, offset);
    const end = shifted(to, offset);
    const labelAt = shifted([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], offset - 32);
    return { start, end, labelAt, extensions: [from, to].map(point => shifted(point, offset - 10)) };
  }
  const vertical = axis === 'y';
  const base = point => vertical ? [offset, point[1]] : [point[0], offset];
  const start = base(from);
  const end = base(to);
  const extend = (point, origin) => vertical
    ? [offset + 10 * Math.sign(offset - origin[0]), point[1]]
    : [point[0], offset + 10 * Math.sign(offset - origin[1])];
  const labelAt = vertical
    ? [offset + labelOffset, (start[1] + end[1]) / 2 + 6]
    : [(start[0] + end[0]) / 2, offset - 12];
  return { start, end, labelAt, extensions: [extend(start, from), extend(end, to)] };
}

function dimensionGraphics(dimension) {
  const { from, to, mark } = dimension;
  const { start, end, labelAt, extensions } = dimensionLayout(dimension);
  const points = [];
  const label = mark + ' ' + Number(distance(dimension).toFixed(2)) + ' mm';
  addLine(points, 'DIMENSIONS', from, extensions[0]);
  addLine(points, 'DIMENSIONS', to, extensions[1]);
  addLine(points, 'DIMENSIONS', start, end);
  for (const [x, y] of [start, end]) {
    addLine(points, 'DIMENSIONS', [x - 4, y + 5], [x + 4, y - 5]);
  }
  addText(points, 'DIMENSIONS', labelAt, label, label, 17, { anchor: 'middle', bold: true });
  return points;
}

const dimensionFields = ['collarWidth', 'shoulderDrop', 'placketWidth', 'bodyLength', 'shoulderWidth', 'sleeveLength'];

function toSvg(geometry) {
  function draw(item) {
    const layer = LAYERS[item.layer];
    const strokes = ' stroke="' + layer.ink + '" stroke-width="' + layer.width
      + '" stroke-linejoin="round" stroke-linecap="round" fill="none"'
      + (layer.dash ? ' stroke-dasharray="' + layer.dash + '"' : '');
    if (item.type === 'line') {
      return '<line x1="' + item.from[0] + '" y1="' + item.from[1] + '" x2="' + item.to[0] + '" y2="' + item.to[1] + '"' + strokes + '/>';
    }
    if (item.type === 'path') {
      const tag = item.closed ? 'polygon' : 'polyline';
      const points = item.points.map(point => point.join(',')).join(' ');
      return '<' + tag + ' points="' + points + '"' + strokes + '/>';
    }
    return '<text x="' + item.position[0] + '" y="' + item.position[1] + '"'
      + ' fill="' + layer.ink + '" font-size="' + item.size + '" font-weight="' + (item.bold ? '600' : '400') + '"'
      + (item.anchor ? ' text-anchor="' + item.anchor + '"' : '') + '>' + xml(item.svgText) + '</text>';
  }
  const marks = dimensionFields.map(key => geometry[key]);
  const base = [
    '<rect width="' + DRAWING_WIDTH + '" height="' + DRAWING_HEIGHT + '" rx="14" fill="#fcfdfb"/>',
    '<path d="M50 164H2050M1790 194V1075" stroke="#dce5e4" stroke-width="2"/>',
    '<rect x="1812" y="291" width="235" height="272" rx="13" fill="#f0f6f5" stroke="#d6e6e2" stroke-width="2"/>',
    '<path d="M1832 464H2028" stroke="#b1c9c1" stroke-width="2" stroke-dasharray="8 7"/>'
  ];
  const body = [...geometry.entities, ...marks.flatMap(dimensionGraphics)].map(draw);
  const points = [...marks.flatMap(({ from, to }) => [from, to]), ...geometry.frontPlacket]
    .map(point => '<circle cx="' + point[0] + '" cy="' + point[1]
    + '" r="5" fill="#fcfdfb" stroke="#006b64" stroke-width="2"/>');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + DRAWING_WIDTH + ' ' + DRAWING_HEIGHT
    + '" role="img" aria-label="模拟款式技术图，标注领宽、落肩、门襟、衣长、肩宽和袖长" font-family="system-ui, Arial, Microsoft YaHei, sans-serif">'
    + '<title>模拟款式技术图</title><desc>正视图、背视图、六项毫米尺寸和校尺。方案版本 V'
    + xml(geometry.revision) + '。</desc>' + [...base, ...body, ...points].join('') + '</svg>';
}

function toDxf(geometry) {
  const entries = [];
  let sequence = 0x100;
  const handle = () => (sequence++).toString(16).toUpperCase();
  const pairs = (...items) => { entries.push(...items); };
  const point = (code, [x, y]) => pairs(code, px(x), code + 10, px(-y), code + 20, 0);
  const section = (type, add) => { pairs(0, 'SECTION', 2, type); add(); pairs(0, 'ENDSEC'); };
  const table = (tableName, count, add) => {
    const tableId = handle();
    pairs(0, 'TABLE', 2, tableName, 5, tableId, 330, '0', 100, 'AcDbSymbolTable', 70, count);
    add(tableId);
    pairs(0, 'ENDTAB');
  };
  const dimensionBlocks = Object.fromEntries(dimensionFields.map((key, index) => ['*D' + (index + 1), geometry[key]]));
  const records = Object.fromEntries(['*Model_Space', '*Paper_Space', ...Object.keys(dimensionBlocks)].map(name => [name, handle()]));
  const common = (kind, owner, layer) => pairs(0, kind, 5, handle(), 330, owner, 100, 'AcDbEntity', 8, layer);

  function entity(item, owner, layer = item.layer) {
    if (item.type === 'line') {
      common('LINE', owner, layer);
      pairs(100, 'AcDbLine');
      point(10, item.from);
      point(11, item.to);
    } else if (item.type === 'path') {
      common('LWPOLYLINE', owner, layer);
      pairs(100, 'AcDbPolyline', 90, item.points.length, 70, item.closed ? 1 : 0);
      for (const [x, y] of item.points) pairs(10, px(x), 20, px(-y));
    } else {
      common('TEXT', owner, layer);
      pairs(100, 'AcDbText');
      point(10, item.position);
      pairs(40, item.size, 1, item.cadText, 7, 'Standard');
      if (item.anchor === 'middle') {
        pairs(72, 1);
        point(11, item.position);
      }
      pairs(100, 'AcDbText');
    }
  }

  section('HEADER', () => {
    pairs(9, '$ACADVER', 1, 'AC1027', 9, '$INSUNITS', 70, 4, 9, '$MEASUREMENT', 70, 1,
      9, '$LUNITS', 70, 2, 9, '$LUPREC', 70, 2);
  });
  section('TABLES', () => {
    table('LTYPE', 4, owner => {
      for (const name of ['ByBlock', 'ByLayer', 'Continuous']) {
        pairs(0, 'LTYPE', 5, handle(), 330, owner, 100, 'AcDbSymbolTableRecord',
          100, 'AcDbLinetypeTableRecord', 2, name, 70, 0, 3, '', 72, 65, 73, 0, 40, 0);
      }
      pairs(0, 'LTYPE', 5, handle(), 330, owner, 100, 'AcDbSymbolTableRecord',
        100, 'AcDbLinetypeTableRecord', 2, 'DASHED', 70, 0, 3, 'Craft construction reference',
        72, 65, 73, 2, 40, 14, 49, 8, 74, 0, 49, -6, 74, 0);
    });
    const layers = [['0', {color: 7}], ...Object.entries(LAYERS)];
    table('LAYER', layers.length, owner => {
      for (const [name, props] of layers) {
        pairs(0, 'LAYER', 5, handle(), 330, owner, 100, 'AcDbSymbolTableRecord',
          100, 'AcDbLayerTableRecord', 2, name, 70, 0, 62, props.color, 6, props.dash ? 'DASHED' : 'Continuous');
      }
    });
    table('STYLE', 1, owner => {
      pairs(0, 'STYLE', 5, handle(), 330, owner, 100, 'AcDbSymbolTableRecord', 100, 'AcDbTextStyleTableRecord',
        2, 'Standard', 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 2.5, 3, 'txt', 4, '');
    });
    table('DIMSTYLE', 1, owner => {
      pairs(0, 'DIMSTYLE', 105, handle(), 330, owner, 100, 'AcDbSymbolTableRecord', 100, 'AcDbDimStyleTableRecord',
        2, 'Standard', 70, 0, 40, 1, 41, 4, 140, 17, 271, 2);
    });
    table('BLOCK_RECORD', Object.keys(records).length, owner => {
      for (const [name, id] of Object.entries(records)) {
        pairs(0, 'BLOCK_RECORD', 5, id, 330, owner, 100, 'AcDbSymbolTableRecord',
          100, 'AcDbBlockTableRecord', 2, name, 70, 0, 280, 1, 281, 0);
      }
    });
  });
  section('BLOCKS', () => {
    for (const [name, id] of Object.entries(records)) {
      common('BLOCK', id, '0');
      const dimension = dimensionBlocks[name];
      pairs(100, 'AcDbBlockBegin', 2, name, 70, dimension ? 1 : 0);
      point(10, [0, 0]);
      pairs(3, name, 1, '');
      if (dimension) {
        for (const item of dimensionGraphics(dimension)) entity(item, id, '0');
      }
      common('ENDBLK', id, '0');
      pairs(100, 'AcDbBlockEnd');
    }
  });
  section('ENTITIES', () => {
    const model = records['*Model_Space'];
    for (const item of geometry.entities) entity(item, model);
    for (const [block, dimension] of Object.entries(dimensionBlocks)) {
      const { start, labelAt } = dimensionLayout(dimension);
      const aligned = dimension.axis === 'aligned';
      common('DIMENSION', model, 'DIMENSIONS');
      pairs(100, 'AcDbDimension', 280, 0, 2, block, 3, 'Standard');
      point(10, start);
      point(11, labelAt);
      pairs(70, aligned ? 33 : 32, 71, 5, 1, dimension.mark + ' <>', 100, 'AcDbAlignedDimension');
      point(13, dimension.from);
      point(14, dimension.to);
      if (!aligned) pairs(50, dimension.axis === 'y' ? 90 : 0, 100, 'AcDbRotatedDimension');
    }
  });
  pairs(0, 'EOF');
  return entries.join('\r\n') + '\r\n';
}

function drawingDescription(solution, geometry) {
  const { placketWidth, collarWidth, shoulderDrop, bodyLength, shoulderWidth, sleeveLength, placket } = geometry;
  const widthMm = distance(placketWidth);
  const id = 'CAD-' + String(solution?.id || 'draft').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) + '-V' + geometry.revision;
  return {
    id,
    measurements: {
      unit: 'mm',
      collar: COLLAR_LABELS[geometry.collar].zh,
      rulerMm: 100,
      placketWidth: widthMm,
      placketWidthMm: widthMm,
      placketFrom: placketWidth.from,
      placketTo: placketWidth.to,
      placketStructure: placket.style.zh,
      placketClosure: PLACKET_CLOSURES[placket.closure].zh,
      ...(placket.closure === 'open' ? { placketWidthDatum: '前中襟缘至贴边内口的模拟水平宽度', constructionReference: '模拟工艺：直筒袖口，两侧下摆开衩内设挡布。尺寸为本版模拟测点。' } : {}),
      collarWidthMm: distance(collarWidth),
      collarWidthFrom: collarWidth.from,
      collarWidthTo: collarWidth.to,
      collarWidthDatum: COLLAR_WIDTH_DATUM,
      shoulderDropMm: distance(shoulderDrop),
      shoulderOffsetMm: geometry.shoulderOffsetMm,
      shoulderDropFrom: shoulderDrop.from,
      shoulderDropTo: shoulderDrop.to,
      shoulderSeamPoint: shoulderDrop.to,
      shoulderDropDatum: SHOULDER_DATUM,
      bodyLengthMm: distance(bodyLength),
      bodyLengthFrom: bodyLength.from,
      bodyLengthTo: bodyLength.to,
      bodyLengthDatum: BODY_LENGTH_DATUM,
      shoulderWidthMm: distance(shoulderWidth),
      shoulderWidthFrom: shoulderWidth.from,
      shoulderWidthTo: shoulderWidth.to,
      shoulderWidthDatum: SHOULDER_WIDTH_DATUM,
      sleeveLengthMm: distance(sleeveLength),
      sleeveLengthFrom: sleeveLength.from,
      sleeveLengthTo: sleeveLength.to,
      sleeveLengthDatum: SLEEVE_LENGTH_DATUM,
      scope: SCOPE
    }
  };
}

export function describeDrawing(solution) {
  return drawingDescription(solution, createGeometry(solution));
}

export function makeDrawing(solution) {
  const geometry = createGeometry(solution);
  return { ...drawingDescription(solution, geometry), svg: toSvg(geometry), dxf: toDxf(geometry) };
}

const SHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter(Boolean).join('、');
  if (value && typeof value === 'object') {
    if (value.name || value.title || value.label) {
      return String(value.name ?? value.title ?? value.label);
    }
    return Object.entries(value).map(([key, item]) => key + '=' + compact(item)).join('；');
  }
  return value ?? '';
}

const asList = value => Array.isArray(value) ? value : [];
const labelScene = scene => scene === 'group' ? '团体职业服' : scene === 'private' ? '海派高级定制' : scene ?? '';
const LEVELS = { required: '硬要求', preferred: '偏好', unspecified: '未指定' };
const SOURCES = { customer: '客户原话', agent: 'Agent 建议', pending: '待顾问确认', advisor: '顾问确认' };
const EVENT_LABELS = {
  intake: '录入需求', extract: '需求解构', confirm: '顾问确认设计参数', match: '参数确认与匹配', solution: '生成参考方案', revision: '修订参考方案',
  visual: '生成图纸与提示词', archive: '人工归档', reuse: '复盘复用', 'export-xlsx': '导出台账', 'export-bundle': '导出案例包',
  'visual-preview': '生成效果示意', 'download-preview': '下载效果示意',
  'visual-photo': '读取或生成写实效果图', 'download-photo': '下载写实效果图',
  'approve-photo': '顾问核对效果图', 'photo-feedback': '记录改款反馈', 'export-delivery': '导出核对版交付包',
  'pattern-review': '版师复核',
  'download-dxf': '下载 DXF', 'download-svg': '下载 SVG', 'copy-prompt': '复制提示词'
};
const ROLE_UNKNOWN = '未记录';

function fieldRows(req, revision, rawText) {
  const fields = Array.isArray(req) ? req : asList(req?.fields);
  const rows = fields.map(field => [
    revision, field.label ?? field.key, compact(field.value), LEVELS[field.level] ?? field.level,
    SOURCES[field.source] ?? field.source, compact(field.evidence)
  ]);
  for (const tag of asList(req?.aestheticTags ?? req?.tags)) {
    const label = compact(tag);
    const exact = typeof rawText === 'string' && asList(req?.aestheticEvidence).find(item =>
      item?.tag === label && typeof item.quote === 'string' && item.quote.trim() && rawText.includes(item.quote));
    rows.push([revision, '审美标签', label, '', exact ? '客户原话' : '待顾问确认', exact?.quote]);
  }
  for (const question of asList(req?.questions)) rows.push([revision, '待确认', compact(question)]);
  return rows;
}

function solutionRows(solution, match, revision, sourceContext, referenceChecks) {
  if (!solution) return [];
  const rows = [
    [revision, '方案标题', solution.id, solution.title, compact(solution.summary)],
    [revision, '采用资产', '', compact(solution.selected)]
  ];
  if (Array.isArray(solution.assets)) {
    for (const item of solution.assets) {
      rows.push([revision, item.type ?? '资产', item.id, item.name, compact(item.description ?? item.reason ?? item.limits)]);
    }
  } else if (solution.assets) {
    for (const [type, item] of Object.entries(solution.assets)) {
      rows.push([revision, type, item?.id, item?.name ?? compact(item), compact(item?.description ?? item?.limits)]);
    }
  }
  for (const section of asList(solution.sections)) rows.push([revision, '方案段落', '', section.title, compact(section.body)]);
  for (const check of asList(solution.checks)) rows.push([revision, '待复核', '', compact(check)]);
  const usedIds = new Set(Object.values(solution.selected ?? {}));
  for (const item of asList(match?.eligible)) {
    if (!usedIds.has(item.id)) rows.push([revision, '同类备选（组合待核）', item.id, item.name, compact(item.reason)]);
  }
  for (const item of asList(match?.rejected)) rows.push([revision, '已排除', item.id, item.name, compact(item.reason)]);
  for (const item of asList(match?.needsReview)) rows.push([revision, '待核候选', item.id, item.name, compact(item.reason)]);
  if (sourceContext) {
    rows.push([revision, '模拟项目输入', sourceContext.id, sourceContext.title, compact(sourceContext.pages)]);
    rows.push([revision, '案例与本版的关系', sourceContext.id, sourceContext.hasAddendum ? '有追加意见' : '模拟案例参照', sourceContext.adaptation]);
    for (const note of asList(sourceContext.design)) rows.push([revision, '模拟项目记录', sourceContext.id, '', note]);
    for (const note of asList(sourceContext.visual)) rows.push([revision, '参考图记录', sourceContext.id, '', note]);
    rows.push([revision, '参考图编号', sourceContext.id, '模拟项目参考图', compact(sourceContext.figures)]);
    for (const note of asList(sourceContext.reviewNotes)) rows.push([revision, '应用前待核', sourceContext.id, '', note]);
  }
  for (const ref of asList(referenceChecks)) {
    rows.push([revision, '公开专业复核依据', ref.id, ref.title, ref.guidance, ref.scope, ref.publisher, ref.sourceTitle, ref.sourceUrl, ref.verifiedOn,
      ref.successor?.standard, ref.successor?.effectiveOn, ref.successor?.url]);
  }
  return rows;
}

export const photoReviewLabels = {
  reviewed: '示例方案设计核对通过', 'advisor-reviewed': '顾问已核对', pending: '待顾问核对', 'changes-requested': '客户反馈待调整',
};

function visualRows(bundle, brief, solution, revision, photos) {
  const rows = [];
  for (const item of asList(brief?.prompts)) {
    const title = item.title ?? item.label ?? '视觉提示词';
    rows.push([revision, title, compact(item.text ?? item.prompt ?? item)]);
    if (item.width && item.height && item.ratio) {
      rows.push([revision, title + '画幅', item.width + ' × ' + item.height + ' px（' + item.ratio + '）']);
      rows.push([revision, title + '核对要点', compact(item.checks)]);
    }
    if (photos) {
      const photo = photos.find(record => record.key === item.key);
      rows.push(photo ? [
        revision, '写实效果图', title, photoReviewLabels[photo.reviewStatus], photo.source,
        photo.width + ' × ' + photo.height + ' px', photo.file, photo.sha256,
        photo.parent && photo.parent !== '0' ? photo.parent : '', photo.designReferenceSha256,
        compact(photo.checks), compact(photo.note), compact(photo.feedback),
      ] : [revision, '写实效果图', title, '本次导出无此图']);
    }
  }
  if (brief?.description) rows.push([revision, '视觉需求', compact(brief.description)]);
  for (const item of asList(brief?.parameters?.dimensions?.requested)) {
    rows.push([revision, '客户尺寸要求', (item.label ?? item.key ?? '') + ' ' + compact(item.value)]);
  }
  const measurements = bundle?.measurements;
  if (bundle || solution?.cad) {
    rows.push(
      [revision, '图纸编号', bundle?.id],
      [revision, '门襟宽（mm）', measurements?.placketWidthMm ?? measurements?.placketWidth ?? solution?.cad?.placketWidth],
      ...(measurements?.placketWidthDatum ? [[revision, '门襟宽测点', measurements.placketWidthDatum],
        [revision, '结构图来源与尺寸含义', measurements.constructionReference]] : []),
      [revision, '衣长（mm）', measurements?.bodyLengthMm ?? solution?.cad?.garmentLength],
      [revision, '衣长测点', measurements?.bodyLengthDatum],
      [revision, '肩宽（mm）', measurements?.shoulderWidthMm ?? solution?.cad?.shoulderWidth],
      [revision, '肩宽测点', measurements?.shoulderWidthDatum],
      [revision, '袖长（mm）', measurements?.sleeveLengthMm ?? solution?.cad?.sleeveLength],
      [revision, '袖长测点', measurements?.sleeveLengthDatum],
      [revision, '领宽（mm）', measurements?.collarWidthMm ?? '未记录'],
      [revision, '领宽测点', measurements?.collarWidthDatum],
      [revision, '落肩垂距（mm）', measurements?.shoulderDropMm ?? '未记录'],
      [revision, '落肩水平距（mm）', measurements?.shoulderOffsetMm ?? '未记录'],
      [revision, '落肩测点', measurements?.shoulderDropDatum],
      [revision, '门襟结构', measurements?.placketStructure],
      [revision, '门襟闭合方式', measurements?.placketClosure],
      [revision, '校尺（mm）', measurements?.rulerMm],
      [revision, '图纸说明', measurements?.scope ?? SCOPE]
    );
  }
  return rows;
}

function getVersions(project) {
  const versions = [...asList(project.history ?? project.versions)];
  const current = project.solution?.version ?? project.version;
  const hasCurrent = current !== undefined && versions.some(item => (
    String(item.version ?? item.solution?.version ?? '') === String(current)
  ));
  if (!hasCurrent) {
    const stored = project.currentRevision?.version === current ? project.currentRevision : null;
    versions.push({ ...project, ...stored, createdAt: stored?.createdAt, version: current || 1 });
  }
  return versions.map((item, index) => ({
    ...item,
    version: item.version ?? item.solution?.version ?? index + 1
  }));
}

function eventKind(event) {
  const kind = event?.type ?? event?.kind;
  if (kind) return kind;
  const message = event?.message ?? event?.reason ?? '';
  if (/^业务人员确认归档 V\d+ 参考稿$/.test(message)) return 'archive';
  if (/^录入原话并生成需求解构草稿/.test(message)) return 'extract';
  if (/^顾问确认需求并匹配/.test(message)) return 'match';
  if (/^生成 V1 初稿$|^更新需求或确认新的资源组合后生成 V\d+$/.test(message)) return 'solution';
  if (/^门襟宽 \d+(?:\.\d+)? → \d+(?:\.\d+)? mm。/.test(message)) return 'revision';
  if (/^生成 V\d+ 模拟技术图与三类视觉提示词$/.test(message)) return 'visual';
  if (/^批准复用|^引用已批准检查项/.test(message)) return 'reuse';
  if (/^复制 V\d+ 视觉提示词/.test(message)) return 'copy-prompt';
  if (/^导出完整案例输出包/.test(message)) return 'export-bundle';
  if (/^导出包含历史版本的 XLSX 台账/.test(message)) return 'export-xlsx';
  return '';
}

function eventVersion(event) {
  const recorded = event?.version ?? event?.solutionVersion;
  if ((typeof recorded === 'number' || typeof recorded === 'string') && Number.isInteger(Number(recorded))) return Number(recorded);
  const legacy = /^业务人员确认归档 V(\d+) 参考稿$/.exec(event?.message ?? '');
  return legacy ? Number(legacy[1]) : null;
}

const eventTime = event => event?.changedAt || event?.at || event?.timestamp || ROLE_UNKNOWN;

function eventActor(event) {
  if (event?.actor) return event.actor;
  const kind = eventKind(event);
  if (kind === 'extract' || kind === 'visual') return '系统';
  return Object.hasOwn(EVENT_LABELS, kind) ? '业务人员（角色）' : ROLE_UNKNOWN;
}

export function archiveMetadata(project, version) {
  const revision = project.currentRevision?.version === version ? project.currentRevision : project.solution?.version === version ? project : asList(project.history).find(item => item.version === version);
  const review = revision ? patternReviewState(project, revision) : {};
  const archive = review.archive ?? asList(project.events ?? project.logs).findLast(event => eventKind(event) === 'archive' && eventVersion(event) === version);
  const archived = Array.isArray(project.archivedVersions) ? project.archivedVersions.some(item => Number(item) === version) : Boolean(archive);
  const decisions = {approved:'复核记录待核', 'revise-requirements':'版师退回需求', 'revise-pattern':'版师退回图纸'};
  const patternReviewStatus = review.archive ? '版师复核通过且已关联归档' : review.approved ? '版师复核通过' : decisions[review.latest?.decision]
    ?? (archived && !revision?.trace ? '历史归档，复核未记录' : '待版师复核');
  return {
    status: archived ? '已归档' : '参考稿',
    archivedAt: archived ? eventTime(archive) : '',
    archivedBy: archived ? eventActor(archive) : '',
    patternReviewStatus, patternReview: review.latest ?? null, archiveReviewId: review.archive?.reviewId ?? null,
  };
}

export function sheetData(project, photos) {
  const versions = getVersions(project);
  const events = asList(project.events ?? project.logs);
  const operations = versions.map(item => {
    const recorded = events.find(event => eventVersion(event) === item.version && ['solution', 'revision'].includes(eventKind(event)));
    const archive = archiveMetadata(project, item.version);
    return [
      item.version, '方案版本', item.changedAt ?? item.createdAt ?? eventTime(recorded), item.actor || eventActor(recorded),
      compact(item.reason ?? recorded?.message ?? item.summary) || '未记录', item.solution?.id,
      archive.status, archive.archivedAt, archive.archivedBy,
      item.trace?.intakeId, item.trace?.requirementId, item.trace?.matchId, item.solution?.id, item.drawing?.id,
      archive.archiveReviewId, archive.patternReviewStatus,
    ];
  });
  for (const event of events) {
    const version = eventVersion(event);
    operations.push([
      version ?? '', Object.hasOwn(EVENT_LABELS, eventKind(event)) ? EVENT_LABELS[eventKind(event)] : event?.title ?? '操作', eventTime(event), eventActor(event),
      compact(event?.comment ?? event?.reason ?? event?.message ?? event?.detail ?? event?.label), event?.id,
      '', '', '',
      event.intakeId, event.requirementId, event.matchId, event.solutionId, event.drawingId, event.reviewId,
      ({approved:'通过', 'revise-requirements':'退回需求', 'revise-pattern':'退回图纸'})[event.decision],
    ]);
  }
  for (const intake of asList(project.intakes).filter(item=>item?.projectId === project.id)) {
    operations.push(['', '顾问原话快照', intake.createdAt, intake.actor, intake.rawText, intake.id, '', '', '', intake.id]);
  }
  for (const confirmation of asList(project.confirmations).filter(item=>item?.projectId === project.id)) {
    const details = asList(confirmation.fields).map(field => [field.label ?? field.key, field.value].filter(Boolean).join(' '));
    operations.push(['', '顾问确认的参数快照', confirmation.changedAt, confirmation.actor, compact(details), confirmation.id,
      '', '', '', confirmation.intakeId, confirmation.id]);
  }
  for (const run of asList(project.matchRuns).filter(item=>item?.projectId === project.id)) {
    operations.push(['', '资源匹配快照', run.changedAt, '', [run.blocked ? '组合待处理' : '已有可用组合', run.reason,
      compact(run.recommended), compact(run.eligibleIds)].filter(Boolean).join('。'), run.id, '', '', '', '', run.requirementId, run.id]);
  }
  const reuse = project.caseNote;
  const currentVersion = project.solution?.version ?? versions.at(-1)?.version;
  const archive = archiveMetadata(project, currentVersion);
  return [
    { name: '项目汇总', widths: [20, 78], rows: [
      ['字段', '内容'],
      ['项目编号', project.id], ['项目名称', project.title ?? project.solution?.title],
      ['场景', labelScene(project.scene ?? project.solution?.scene)], ['客户原话', project.text ?? project.rawText],
      ['当前版本', currentVersion], ['版本状态', archive.status],
      ['归档时间（UTC）', archive.archivedAt], ['归档确认角色', archive.archivedBy],
      ['版师复核状态', archive.patternReviewStatus], ['最近复核意见', archive.patternReview?.comment], ['归档关联复核编号', archive.archiveReviewId],
      ['资产库版本', project.solution?.cad?.templateVersion],
      ['复盘', compact(reuse?.text ?? reuse?.checklist ?? reuse)],
      ['业务边界', '模拟数据，仅供顾问和版师沟通。定稿、报价、签约与生产由业务人员负责。']
    ] },
    { name: '需求与审美', widths: [11, 18, 36, 16, 19, 48], rows: [
      ['版本', '字段', '内容', '约束', '来源', '原话证据'],
      ...versions.flatMap(item => fieldRows(item.requirements, item.version, item.text ?? item.rawText))
    ] },
    { name: '方案与资源', widths: [11, 23, 26, 42, 60, 46, 30, 48, 68, 18, 24, 20, 68], rows: [
      ['版本', '类型', '资源或方案编号', '名称或位置', '理由或说明', '资料适用范围', '发布机构', '公开资料名称', '资料网址', '查核日期', '后续版本', '后续版本实施日期', '后续版本来源网址'],
      ...versions.flatMap(item => solutionRows(item.solution, item.match, item.version, item.sourceContext, item.referenceChecks))
    ] },
    { name: '视觉与图纸', widths: [11, 26, 80, 23, 35, 24, 42, 68, 68, 68, 52, 52, 46], rows: [
      ['版本', '项目', '内容', '写实图核对状态', '图像来源', '实际像素', '配套案例包内文件', '图片 SHA-256', '同版母图 SHA-256', '原款参考图 SHA-256', '本图核对事项', '局部修改或沿用说明', '图像反馈'],
      ...versions.flatMap(item => visualRows(item.drawing, item.brief, item.solution, item.version, item.version === currentVersion ? photos : null))
    ] },
    { name: '操作与版本', widths: [11, 20, 28, 20, 56, 24, 14, 28, 20, 30, 30, 30, 30, 30, 30, 30], rows: [
      ['版本', '事件', '时间（UTC）', '操作角色', '原因或变更', '关联编号', '版本状态', '归档时间（UTC）', '归档确认角色',
        '原话编号', '需求快照编号', '匹配编号', '方案编号', '图纸编号', '版师复核编号', '版师复核结果'],
      ...operations
    ] }
  ];
}

function columnRef(index) {
  return String.fromCharCode(65 + index);
}

function cellXml(value, rowIndex, colIndex) {
  const reference = columnRef(colIndex) + rowIndex;
  const style = rowIndex === 1 ? '1' : '2';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return '<c r="' + reference + '" s="' + style + '"><v>' + value + '</v></c>';
  }
  return '<c r="' + reference + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">'
    + xml(String(compact(value)).slice(0, 12000)) + '</t></is></c>';
}

function sheetXml(sheet) {
  const rows = sheet.rows.map((cells, index) => {
    const rowIndex = index + 1;
    const longest = cells.reduce((length, item) => Math.max(length, String(compact(item)).length), 0);
    const height = index === 0 ? 25 : Math.min(128, Math.max(21, Math.ceil(longest / 46) * 17));
    return '<row r="' + rowIndex + '" ht="' + height + '" customHeight="1">'
      + cells.map((value, colIndex) => cellXml(value, rowIndex, colIndex)).join('') + '</row>';
  }).join('');
  const cols = sheet.widths.map((width, index) => '<col min="' + (index + 1) + '" max="' + (index + 1) + '" width="' + width + '" customWidth="1"/>').join('');
  return XML_DECL + '<worksheet xmlns="' + SHEET_NS + '"><sheetViews><sheetView workbookViewId="0">'
    + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    + '</sheetView></sheetViews><cols>' + cols + '</cols><sheetData>' + rows
    + '</sheetData><autoFilter ref="A1:' + columnRef(sheet.widths.length - 1) + Math.max(sheet.rows.length, 1) + '"/></worksheet>';
}

export function makeWorkbook(project, photos = []) {
  const sheets = sheetData(project ?? {}, photos);
  const sheetOverrides = sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('');
  const types = XML_DECL + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + sheetOverrides + '</Types>';
  const rootRels = XML_DECL + '<Relationships xmlns="' + PACKAGE_REL + '"><Relationship Id="rId1" Type="'
    + OFFICE_REL + '/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const workbook = XML_DECL + '<workbook xmlns="' + SHEET_NS + '" xmlns:r="' + OFFICE_REL + '">'
    + '<bookViews><workbookView activeTab="0"/></bookViews><sheets>'
    + sheets.map((sheet, index) => '<sheet name="' + xml(sheet.name) + '" sheetId="' + (index + 1)
      + '" r:id="rId' + (index + 1) + '"/>').join('') + '</sheets></workbook>';
  const relations = XML_DECL + '<Relationships xmlns="' + PACKAGE_REL + '">'
    + sheets.map((_, index) => '<Relationship Id="rId' + (index + 1) + '" Type="' + OFFICE_REL
      + '/worksheet" Target="worksheets/sheet' + (index + 1) + '.xml"/>').join('')
    + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="' + OFFICE_REL + '/styles" Target="styles.xml"/></Relationships>';
  const styles = XML_DECL + '<styleSheet xmlns="' + SHEET_NS + '">'
    + '<fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font>'
    + '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font></fonts>'
    + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FF12333D"/><bgColor indexed="64"/></patternFill></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const entries = {
    '[Content_Types].xml': strToU8(types),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(relations),
    'xl/styles.xml': strToU8(styles)
  };
  sheets.forEach((sheet, i) => { entries['xl/worksheets/sheet' + (i + 1) + '.xml'] = strToU8(sheetXml(sheet)); });
  return zipSync(entries, { level: 6 });
}
