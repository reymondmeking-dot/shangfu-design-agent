import { strToU8, zipSync } from "fflate";
import { catalog, catalogVersion, extractRequirements, makeVisualBrief, matchResources, normalizeRequirements, normalizeScene } from "./engine.mjs";
import { archiveMetadata, describeDrawing, exportDrawingModel, makeDrawing, makeWorkbook, photoReviewLabels, sheetData, ledgerRequirement, ledgerAssetLabels, ledgerSceneLabels } from "./exports.mjs";
import { makeVisualPreviews } from "./visual-preview.mjs";
import { referenceChecksFor } from "./knowledge.mjs";
import { sourceCases, sourceContextFor } from "./source-cases.mjs";

const typeLabels = { pattern: "版型", fabric: "面料", craft: "工艺", case: "历史案例" };
const sceneLabels = { private: "海派高端私定", group: "团体职业服" };
const sourceLabels = { customer: "客户原话", agent: "Agent 建议", pending: "待确认", advisor: "顾问确认" };
const scope = "本项目使用静态模拟数据。输出供需求确认、概念沟通与业务归档。定稿、报价、商务洽谈、签约及生产下单由业务人员负责。";
const visualScope = "视觉预览按同版方案参数绘制。色样、面料纹理和上身场景供沟通，量体、样布及试穿由业务人员核对。";
const catalogStyles = new Set(["新中式", "商务", "正式", "简约", "休闲", "演出", "传统工艺"]);
const previewFiles = {
  garment: "视觉预览/01-成衣正背面.svg",
  detail: "视觉预览/02-工艺与材质特写.svg",
  "on-body": "视觉预览/03-上身与场景氛围.svg",
};
const manifestFile = "11-交付验收清单.json";

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join("、");
  return typeof value === "string" || typeof value === "number"
    ? String(value).replaceAll("\0", "").trim()
    : "";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function md(value) {
  const escaped = text(value).replace(/\s+/g, " ")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return escaped.replace(/[\\[\]()*_\x60#!|]/g, "\\$&");
}

function line(value, fallback = "待确认") {
  return md(value) || fallback;
}

function bullets(values, fallback = "待顾问补充。") {
  const rows = values.map(value => line(value, "")).filter(Boolean);
  return (rows.length ? rows : [fallback]).map(value => "- " + value).join("\n");
}

function csvCell(value) {
  const raw = typeof value === "string" ? value.replaceAll("\0", "") : text(value);
  // Excel and other spreadsheet clients may interpret quoted CSV strings as formulas.
  const dangerous = /^[\t\r\n]|^[\s\u00a0\uFEFF]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/.test(raw);
  return '"' + (dangerous ? "'" + raw : raw).replaceAll('"', '""') + '"';
}

function csv(rows) {
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function makeCatalogCsv() {
  const header = ["资产编号", "资源类别", "资源名称", "适配场景", "标签", "风格标签", "适配说明", "使用规范与限制", "数据来源", "资产库版本", "参照案例与对应关系"];
  const records = catalog.map(item => [
    item.id, ledgerAssetLabels[item.type], item.name, item.scenes.map(scene => ledgerSceneLabels[scene]),
    item.tags, item.tags.filter(tag => catalogStyles.has(tag)), item.description, item.limits, "集团业务场景模拟数据", catalogVersion,
    sourceCases.filter(source => source.assetReferences[item.id]).map(source =>
      `${source.id} ${source.title}（${source.pages}），${source.assetReferences[item.id]}`).join("\n"),
  ]);
  return csv([header, ...records]);
}

function snapshotOf(project) {
  const base = project ?? {};
  const current = base.currentRevision;
  if (!current || current.version !== base.solution?.version) return base;
  return {
    ...base,
    text: current.text ?? base.text,
    scene: base.solution.scene ?? current.scene ?? base.scene,
    requirements: current.requirements ?? base.requirements,
  };
}

function snapshotWithMatch(project) {
  const base = snapshotOf(project);
  const current = base.currentRevision;
  const stored = current?.version === base.solution.version ? current.match : null;
  return {...base, match: stored ?? base.match ?? matchResources({requirements:base.requirements,scene:base.scene ?? base.solution.scene})};
}

function generatedRecord(record, drawing = describeDrawing(record.solution)) {
  const raw = text(record.text ?? record.rawText ?? record.solution.sourceText);
  return {
    ...record, drawing, brief: makeVisualBrief(record.solution, drawing),
    sourceContext: sourceContextFor(raw, record.solution.scene), referenceChecks: referenceChecksFor(record.solution),
  };
}

function workbookRecord(snapshot) {
  const { currentRevision, drawing, brief } = snapshot;
  return {
    ...snapshot,
    currentRevision: currentRevision ? {
      ...currentRevision, requirements: snapshot.requirements, match: snapshot.match, solution: snapshot.solution,
      drawing, brief, sourceContext: snapshot.sourceContext, referenceChecks: snapshot.referenceChecks,
    } : null,
    history: list(snapshot.history).map(record => record?.solution?.cad ? generatedRecord(record) : record),
  };
}

export function makeProjectWorkbook(project, photos = []) {
  const snapshot = generatedRecord(snapshotWithMatch(project));
  return makeWorkbook(workbookRecord(snapshot), photos);
}

function evidenceParts(evidence, rawText) {
  const raw = text(rawText);
  return text(evidence).split(/\s*[｜¦]\s*/).map(value => value.trim())
    .filter(value => value && raw.includes(value));
}

function requirementsCsv(snapshot, fields) {
  const status = archiveMetadata(snapshot, snapshot.solution?.version).status;
  const trace = snapshot.currentRevision?.trace ?? snapshot.trace;
  return csv([
    ["项目编号", "方案版本", "字段编号", "设计维度", "参数值", "约束等级", "来源", "原话出处", "核验状态", "版本状态", "原话编号", "顾问确认快照编号"],
    ...fields.map(field => {
      const values = ledgerRequirement(field,snapshot.text ?? snapshot.rawText);
      return [
        snapshot.id, snapshot.solution?.version, field.key, ...values,
        values[4] ? "可回查" : field.source === "customer" ? "原话待核" : "按字段来源处理", status,
        trace?.intakeId, trace?.requirementId,
      ];
    }),
  ]);
}

function header(title, snapshot) {
  const archive = archiveMetadata(snapshot, snapshot.solution?.version);
  return "# " + title + "\n\n" + line(snapshot.title ?? snapshot.solution?.title, "海派定制项目")
    + "（" + line(snapshot.id, "项目待编号") + "，V" + line(snapshot.solution?.version, "—") + "，" + archive.status + "）"
    + (archive.status === "已归档" ? "\n\n归档时间（UTC） " + line(archive.archivedAt) + "，确认角色为" + line(archive.archivedBy) + "。" + line(archive.patternReviewStatus) + "。" : "")
    + "\n\n" + scope + "\n";
}

const aestheticEvidence = {
  新中式: /新中式|中式|海派|东方感|国风/,
  简约利落: /简约|简洁|利落|干净|大方|大气|低调|克制/,
  商务: /商务|通勤|职场风格|职业(?:感|形象|气质|风格)/,
  优雅: /优雅|端庄|得体|有气质/,
  休闲: /休闲|松弛/,
  古典: /古典|复古|传统/,
  活力: /明快|活力|上镜/,
  细暗纹: /暗纹|暗花/,
  哑光: /哑光|低光泽/,
  有垂感: /垂感|垂坠/,
  肌理: /肌理|纹理/,
  得体: /得体/,
  克制: /克制/,
};
const wearingEvidence = [
  ["舒展自在", /舒展|自在|不(?:要)?束缚|穿着(?:舒服|舒适)/],
  ["沉稳从容", /沉稳|稳重|从容/],
  ["正式庄重", /庄重|郑重|端庄/],
  ["轻松明快", /轻松|明快|活力|活泼/],
];

function supportsTag(tag, excerpt, expression = aestheticEvidence[tag]) {
  const index = expression instanceof RegExp ? excerpt.search(expression) : excerpt.indexOf(tag);
  if (index < 0) return false;
  const leadingContext = excerpt.slice(Math.max(0, index - 20), index);
  return !/(?:不要|不喜欢|不偏好|不想要?|不接受|无需|不需要|避免|拒绝|不宜|别|并不|并非)(?:(?:做|选|用|穿|采用|呈现|显得|太|太过|过于|那么|过分)\s*)*$/.test(leadingContext);
}

function aestheticReport(snapshot, fields) {
  const raw = text(snapshot.text ?? snapshot.rawText);
  const exact = extractRequirements({ text: raw, scene: snapshot.scene });
  const tags = [...new Set([...list(snapshot.requirements?.aestheticTags), ...exact.aestheticTags].map(text).filter(Boolean))].slice(0, 24);
  const evidencedTags = [...list(snapshot.requirements?.aestheticEvidence), ...list(exact.aestheticEvidence)];
  const clauses = raw.split(/[，。；、！？,;.!?\n]/).map(value => value.trim()).filter(Boolean);
  const grounded = [];
  const proposed = [];
  for (const tag of tags) {
    const verified = evidencedTags.filter(item => item?.tag === tag && typeof item.quote === "string" && item.quote.trim());
    const preferredClauses = clauses.filter(clause => verified.some(item => clause.includes(item.quote)));
    const quote = clauses.find(clause => supportsTag(tag, clause, null))
      ?? [...preferredClauses, ...clauses].find(clause => supportsTag(tag, clause));
    if (quote) grounded.push(tag + "（原话「" + quote + "」）");
    else proposed.push(tag);
  }
  const impressions = wearingEvidence.flatMap(([label, expression]) => {
    const quote = clauses.find(clause => supportsTag(label, clause, expression));
    return quote ? [label + "（原话「" + quote + "」）"] : [];
  });
  const preferences = fields.filter(field => ["style", "silhouette", "fabric", "color", "scene", "headcount", "wearers", "activity", "replenishment"].includes(field.key) && text(field.value))
    .map(field => {
      const quote = evidenceParts(field.evidence, raw).join("、");
      return field.label + "｜" + field.value + "（" + (sourceLabels[field.source] ?? "待确认") + "）" + (quote ? "，原话「" + quote + "」" : "");
    });
  return [
    header("客户情绪审美标签报告", snapshot),
    "\n## 客户描述\n\n> " + line(raw, "当前快照未提供客户原话。") + "\n",
    "\n## 原话支持的审美风格\n\n" + bullets(grounded, "暂无可回查的审美标签。") + "\n",
    "\n## 期望的穿着感受\n\n" + bullets(impressions, "客户尚未明确表达穿着感受，待顾问确认。") + "\n",
    "\n## 设计偏好与适用条件\n\n" + bullets(preferences) + "\n",
    "\n## 待顾问核对的标签\n\n" + bullets(proposed, "暂无额外建议标签。") + "\n",
  ].join("");
}

function solutionReport(snapshot) {
  const solution = snapshot.solution;
  const content = list(solution?.sections).map(section => "## " + line(section?.title, "设计说明") + "\n\n" + line(section?.body) + "\n");
  const source = snapshot.sourceContext;
  const origin = source
    ? "\n## 模拟案例与本版演示\n\n公开模拟项目：" + line(source.title) + "（" + line(source.id) + "），" + line(source.pages) + "。\n\n"
      + line(source.adaptation) + "\n\n### 模拟项目记录\n\n" + bullets(list(source.design)) + "\n\n### 参考图记录\n\n"
      + bullets(list(source.visual), "该案例没有登记可核对的配图。") + "\n\n另附参考图 " + line(source.figures) + "。\n"
      + (list(source.reviewNotes).length ? "\n### 应用前待核\n\n" + bullets(source.reviewNotes) + "\n" : "")
    : "";
  return header("海派定制整体方案初稿", snapshot) + "\n"
    + "适用场景为" + line(sceneLabels[normalizeScene(snapshot.scene ?? solution?.scene)]) + "。\n\n"
    + line(solution?.summary, "方案内容待顾问补充。") + "\n\n"
    + content.join("\n") + origin + "\n## 人工复核\n\n" + bullets(list(solution?.checks)) + "\n";
}

function solutionAssets(solution) {
  if (list(solution?.assets).length) return solution.assets;
  return Object.values(solution?.selected ?? {}).flatMap(id => catalog.filter(entry => entry.id === id));
}

function matchingReport(snapshot) {
  const { match, solution } = snapshot;
  const chosen = solutionAssets(solution);
  const records = chosen.map(asset => {
    const item = list(match?.eligible).find(candidate => candidate.id === asset.id);
    return [
      typeLabels[asset.type], asset.id, asset.name, item?.reason ?? asset.reason ?? asset.description,
      ...list(asset.limits),
    ].map(text).filter(Boolean).join("，");
  });
  const exceptions = [
    ...list(match?.rejected).filter(item => item?.reason && item.reason !== "与当前业务场景不符")
      .map(item => "排除 " + item.id + " " + item.name + "，" + item.reason),
    ...list(match?.needsReview).map(item => "待核 " + item.id + " " + item.name + "，" + item.reason),
  ];
  const selectedIds = new Set(chosen.map(asset => asset.id));
  const alternatives = list(match?.eligible).filter(item => !selectedIds.has(item.id))
    .map(item => [typeLabels[item.type], item.id, item.name, item.reason].filter(Boolean).join("，"));
  return header("资源匹配适配说明与方案可行性提示", snapshot)
    + "\n## 本版采用的资源\n\n" + bullets(records) + "\n"
    + "\n## 同类备选\n\n" + bullets(alternatives, "当前没有其他通过单项筛选的资产。")
    + "\n\n换用备选资源后，系统重新核对版型、面料与工艺的组合。\n"
    + "\n## 筛选与候选说明\n\n" + line(match?.reason, "匹配理由待补充。")
    + "\n\n" + bullets(exceptions, "本次未记录硬条件冲突或待核资产。") + "\n"
    + "\n## 可行性和人工复核\n\n" + bullets(list(solution?.checks)) + "\n"
    + (snapshot.referenceChecks.length ? "\n## 相关公开专业资料\n\n" + snapshot.referenceChecks.map(ref =>
      "### " + line(ref.title) + "\n\n" + line(ref.guidance) + "\n\n适用范围为" + line(ref.scope)
      + "。查核日期为 " + line(ref.verifiedOn) + "。[" + line(ref.sourceTitle) + "（" + line(ref.publisher) + "）](" + ref.sourceUrl + ")"
      + (ref.successor ? "\n\n后续版本自 " + line(ref.successor.effectiveOn) + " 实施。[" + line(ref.successor.standard) + "](" + ref.successor.url + ")" : "") + "\n"
    ).join("\n") : "");
}

function promptReport(snapshot, prompts) {
  const blocks = prompts.map((item, index) => [
    "## " + line(item?.title, "视觉提示词 " + (index + 1)),
    "",
    "画幅 " + line(item.ratio) + "，建议尺寸 " + item.width + " × " + item.height + " 像素。",
    "",
    line(item?.text ?? item?.prompt),
    "",
    "避免 " + line(item.avoid),
    "",
    "### 工具输入",
    "",
    "- 支持参考图的工具使用同版预览及技术图，并配合正文与避免项。" + (item.profiles?.referenceImage ? " " + line(item.profiles.referenceImage) : ""),
    "- 仅接收自然语言的工具合并正文与避免项。",
    "- ComfyUI 可将以下正向及负向文本分别接入对应的提示节点。",
    "",
    "正向 " + line(item.profiles?.positive ?? item.text),
    "",
    "负向 " + line(item.profiles?.negative ?? item.avoid),
    "",
    ...(item.profiles?.midjourney ? ["Midjourney " + line(item.profiles.midjourney), ""] : []),
  ].join("\n"));
  return header("成套标准化 AI 视觉提示词", snapshot) + "\n"
    + visualScope + "\n\n" + blocks.join("\n")
    + "\n工具的最终像素规格以实际出图为准，交付前按本报告规格核对。 [Midjourney 画幅说明](https://docs.midjourney.com/hc/en-us/articles/31894244298125-Aspect-Ratio) [ComfyUI 生图工作流](https://docs.comfy.org/tutorials/basic/text-to-image)\n";
}

function visualPackageReport(snapshot, images, photos) {
  const { brief, drawing } = snapshot;
  const { parameters } = brief;
  const blocks = images.map(({ filename, prompt, width, height }) => {
    const photo = photos.find(item => item.key === prompt.key);
    return [
    "## " + line(prompt.title),
    "",
    "[打开同版参数化预览](<" + filename + ">)",
    photo ? "[打开写实效果图](<" + photo.file + ">)  " + photoReviewLabels[photo.reviewStatus] : "此视角尚无可归档的写实效果图。",
    ...(photo ? ["", "图像来源为 " + line(photo.source) + "。"] : []),
    ...(photo?.note ? [line(photo.note)] : []),
    ...(photo?.feedback?.length ? ["", ...photo.feedback.map(value=>"客户反馈："+line(value))] : []),
    "",
    "- 画幅 " + line(prompt.ratio) + "，" + width + " × " + height + " 像素。",
    "- 对照编号 " + line(drawing.id) + "。",
    "- 避免 " + line(prompt.avoid) + "。",
    "",
    "### 需求包核对要点",
    "",
    bullets(list(prompt.checks)),
    ...(photo && ['reviewed','advisor-reviewed'].includes(photo.reviewStatus) && list(photo.checks).length
      ? ["", "### 本图已登记的核对记录", "", bullets(photo.checks)] : []),
  ].join("\n");
  });
  const summary = [
    ...solutionAssets(snapshot.solution).filter(asset => asset.type !== "case").map(asset => typeLabels[asset.type] + " " + asset.id + " " + asset.name),
    "领型 " + text(parameters.collar),
    "门襟闭合 " + text(drawing.measurements.placketClosure),
    "色彩 " + text(parameters.color?.value ?? snapshot.solution.color),
    "穿着场景 " + (text(parameters.environment) || "待顾问确认"),
  ];
  return header("定制视觉效果需求包", snapshot) + "\n" + visualScope
    + "\n\n## 同版共用约束\n\n" + bullets(summary) + "\n\n" + blocks.join("\n\n") + "\n";
}

function previewRecords(previews, brief) {
  if (previews.version !== brief.version || previews.solutionId !== brief.solutionId) {
    throw new Error("预览与方案版本不一致");
  }
  return brief.prompts.map(prompt => {
    const image = list(previews.images).find(item => item?.key === prompt.key);
    const filename = previewFiles[prompt.key];
    const rootTag = image?.svg?.match(/<svg\b[^>]*>/u)?.[0];
    const width = Number(/\bwidth="(\d+)"/u.exec(rootTag)?.[1]);
    const height = Number(/\bheight="(\d+)"/u.exec(rootTag)?.[1]);
    if (!filename || !image || width !== image.width || height !== image.height || width !== prompt.width || height !== prompt.height) {
      throw new Error("预览规格与视觉需求不一致");
    }
    return { ...image, filename, prompt };
  });
}

function caseManifest(snapshot, previews, images, photos, files) {
  const { brief, drawing, solution } = snapshot;
  const requested = brief.parameters.dimensions.requested ?? [];
  const nominal = solution.cad;
  const measured = drawing.measurements;
  const rawText = text(snapshot.text ?? snapshot.rawText);
  const checks = [
    [measured.placketWidthDatum ? "襟缘至贴边内口的模拟水平宽度" : "门襟宽", nominal.placketWidthMm ?? nominal.placketWidth, measured.placketWidthMm],
    ["衣长", nominal.garmentLength, drawing.measurements.bodyLengthMm],
    ["肩宽", nominal.shoulderWidth, drawing.measurements.shoulderWidthMm],
    ["袖长", nominal.sleeveLength, drawing.measurements.sleeveLengthMm],
    ["校尺", 100, drawing.measurements.rulerMm],
  ].map(([label, specificationMm, measuredMm]) => ({
    label, specificationMm, measuredMm,
    agrees: typeof specificationMm === "number" && typeof measuredMm === "number" && Math.abs(specificationMm - measuredMm) <= 0.01,
  }));
  const geometryDatums = [
    ['A', '领宽', 0, measured.collarWidthFrom, measured.collarWidthTo, measured.collarWidthMm],
    ['B', '落肩垂距', 1, measured.shoulderDropFrom, measured.shoulderDropTo, measured.shoulderDropMm],
  ].map(([mark, label, axis, from, to, measuredMm]) => {
    const spanMm = Math.abs(to[axis] - from[axis]);
    return {mark, label, axis: axis === 0 ? 'x' : 'y', from, to, spanMm, measuredMm, agrees: Math.abs(measuredMm - spanMm) <= 0.01};
  });
  return {
    formatVersion: 2,
    projectId: snapshot.id,
    solutionId: solution.id,
    version: solution.version,
    scene: solution.scene ?? snapshot.scene,
    archive: archiveMetadata(snapshot, solution.version),
    workflow: {
      trace: snapshot.currentRevision?.trace ?? snapshot.trace ?? null,
      intakes: list(snapshot.intakes).filter(item => item?.projectId === snapshot.id),
      confirmations: list(snapshot.confirmations).filter(item => item?.projectId === snapshot.id),
      matchRuns: list(snapshot.matchRuns).filter(item => item?.projectId === snapshot.id),
      previousVersionTraces: list(snapshot.history).filter(item => item?.trace?.projectId === snapshot.id)
        .map(item => ({version: item.version, trace: item.trace})),
    },
    input: {
      text: rawText, scene: solution.scene, caseSource: snapshot.sourceContext,
      fields: normalizeRequirements(snapshot.requirements).map(field => ({
        key: field.key, label: field.label, value: field.value, level: field.level, source: field.source,
        quotes: evidenceParts(field.evidence, rawText),
      })),
    },
    referenceChecks: snapshot.referenceChecks,
    catalogVersion: solution.cad?.templateVersion ?? catalogVersion,
    assets: solutionAssets(solution).map(({ type, id, name }) => ({ type, id, name })),
    deliverables: [
      ...Object.keys(files).filter(name => !name.includes('/')).sort(), manifestFile,
      ...images.map(image => image.filename),
      ...photos.map(photo => photo.file).sort(),
    ],
    cad: {
      id: drawing.id, unit: measured.unit, measurements: measured, checks, geometryDatums,
      auditScope: "同版模拟基版毫米数与生成几何对照，成衣合体性由业务人员验证。",
      requested,
    },
    visual: {
      mode: previews.mode, parameters: brief.parameters, renderColor: previews.manifest?.color, renderScene: previews.manifest?.scene,
      photos: {
        status: !photos.length ? "unavailable" : photos.some(item=>item.reviewStatus === "changes-requested") ? "changes-requested"
          : photos.length < images.length ? "partial" : photos.some(item=>item.reviewStatus === "pending") ? "pending" : "reviewed",
        missing: images.filter(image=>!photos.some(photo=>photo.key === image.key)).map(image=>image.key),
        views: photos.map(({key,file,source,reviewStatus,width,height,sha256,checks,feedback,parent,designReferenceSha256,editMethod,editRegion,lockedRegion,note})=>
          ({key,file,source,reviewStatus,width,height,sha256,checks,feedback,referenceSha256:parent && parent !== '0' ? parent : null,designReferenceSha256:designReferenceSha256 ?? null,
            ...(editMethod ? {editMethod,editRegion,lockedRegion,note} : {})})),
      },
      views: images.map(({ id, key, filename, prompt, width, height }) => ({
        id, key, file: filename, ratio: prompt.ratio, width, height, checks: prompt.checks,
      })),
    },
  };
}

export function preparePythonExport(project, photos = [], delivery = false) {
  const base = snapshotWithMatch(project);
  const drawing = describeDrawing(base.solution);
  const snapshot = generatedRecord(base, drawing);
  const previews = makeVisualPreviews(snapshot.solution, {brief:snapshot.brief,drawing});
  const images = previewRecords(previews,snapshot.brief);
  const textFiles = {
    '01-定制资源分类清单.csv': makeCatalogCsv(),
    '02-定制需求结构化参数清单.csv': requirementsCsv(snapshot,normalizeRequirements(snapshot.requirements)),
    '03-客户情绪审美标签报告.md': aestheticReport(snapshot,normalizeRequirements(snapshot.requirements)),
    '05-资源匹配适配说明与方案可行性提示.md': matchingReport(snapshot),
    '07-定制视觉效果需求包.md': visualPackageReport(snapshot,images,photos),
    ...Object.fromEntries(images.map(image=>[image.filename,image.svg])),
  };
  const outputs = ['04-海派定制整体方案初稿.md','06-成套标准化AI视觉提示词.md','08-定制业务专题台账.xlsx','09-款式技术平面图.svg','10-款式技术平面图.dxf'];
  const names = Object.fromEntries([...Object.keys(textFiles),...outputs,...photos.map(photo=>photo.file)].map(key=>[key,null]));
  const manifest=caseManifest(snapshot,previews,images,photos,names);
  manifest.packagePurpose = delivery ? '核对版交付包' : '内部工作包';
  const photoFiles = photos.map(({file,bytes})=>{
    const chunks=[];
    for(let i=0;i<bytes.length;i+=32768) chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
    return {file,data:btoa(chunks.join(''))};
  });
  return {solution:snapshot.solution,drawing,brief:snapshot.brief,geometry:exportDrawingModel(snapshot.solution),
    sheets:sheetData(workbookRecord(snapshot),photos),textFiles,photoFiles,manifest,source:snapshot.sourceContext,
    sceneLabel:sceneLabels[normalizeScene(snapshot.scene ?? snapshot.solution.scene)],
    designHeader:header('海派定制整体方案初稿',snapshot),promptHeader:header('成套标准化 AI 视觉提示词',snapshot),visualScope};
}

export function makeArtifactPack(project, photos = [], delivery = false) {
  const base = snapshotWithMatch(project);
  const drawing = makeDrawing(base.solution);
  const snapshot = generatedRecord(base, drawing);
  const fields = normalizeRequirements(snapshot.requirements);
  const previews = makeVisualPreviews(snapshot.solution, { brief: snapshot.brief, drawing });
  const images = previewRecords(previews, snapshot.brief);
  const files = {
    "01-定制资源分类清单.csv": strToU8(makeCatalogCsv()),
    "02-定制需求结构化参数清单.csv": strToU8(requirementsCsv(snapshot, fields)),
    "03-客户情绪审美标签报告.md": strToU8(aestheticReport(snapshot, fields)),
    "04-海派定制整体方案初稿.md": strToU8(solutionReport(snapshot)),
    "05-资源匹配适配说明与方案可行性提示.md": strToU8(matchingReport(snapshot)),
    "06-成套标准化AI视觉提示词.md": strToU8(promptReport(snapshot, snapshot.brief.prompts)),
    "07-定制视觉效果需求包.md": strToU8(visualPackageReport(snapshot, images, photos)),
    "08-定制业务专题台账.xlsx": makeWorkbook(workbookRecord(snapshot), photos),
    "09-款式技术平面图.svg": strToU8(drawing.svg),
    "10-款式技术平面图.dxf": strToU8(drawing.dxf),
  };
  for (const image of images) files[image.filename] = strToU8(image.svg);
  for (const photo of photos) files[photo.file] = [photo.bytes, { level: 0 }];
  const manifest = caseManifest(snapshot, previews, images, photos, files);
  manifest.packagePurpose = delivery ? "核对版交付包" : "内部工作包";
  files[manifestFile] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(Object.fromEntries(manifest.deliverables.map(name => [name, files[name]])), { level: 6 });
}
