import {readFileSync} from 'node:fs';
import {exportDrawingModel} from '../src/exports.mjs';

const solution = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(exportDrawingModel(solution)));
