import { demoCases } from './demo-cases.mjs';

const notes = [
  { design: ['按舞台抬臂动作核对袖窿松量。'], reviewNotes: ['用样布确认灯光下的暗纹。'], tags: ['开幕酒会','私定'], assetReferences: {} },
  { design: ['记录礼宾站姿和搬运行李时的活动需求。'], reviewNotes: ['比较机洗样衣与原样布，补货时复核批次色差。'], tags: ['礼宾','职业服'], assetReferences: {} },
];
export const sourceCases = demoCases.map((sample,index) => ({
  id: 'SIM-00'+(index+1), title: sample.title, pages: '公开模拟输入',
  figures: [], visual: [], adaptation: '由虚构需求建立；规格与样衣需人工复核。', ...notes[index],
}));

export function sourceContextFor(rawText, scene) {
  const value=String(rawText ?? '').trim();
  const index=demoCases.findIndex(sample => sample.scene===scene && sample.text===value);
  return index===-1 ? null : {...sourceCases[index],hasAddendum:false};
}
