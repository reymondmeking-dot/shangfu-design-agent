import {catalog,catalogVersion,demoCases,createSolution,makeVisualBrief,matchingEvidence,extractRequirements,suggestCaseNote} from '../src/engine.mjs';
import * as drawingApi from '../src/exports.mjs';
import {sourceCases} from '../src/source-cases.mjs';
import {knowledgeSources} from '../src/knowledge.mjs';
let data='';
for await (const part of process.stdin) data+=part;
try{
  const {op,p}=JSON.parse(data);
  let result;
  switch(op){
    case 'assets': result={catalog,catalogVersion,cases:demoCases,sourceCases,knowledgeSources};break;
    case 'extract': result=extractRequirements(p);break;
    case 'evidence': result=matchingEvidence(p.requirements,p.scene);break;
    case 'proposal': {
      const solution=createSolution(p);
      if(p.solutionId)solution.id=p.solutionId;
      const drawing=drawingApi.describeDrawing(solution);
      const brief=makeVisualBrief(solution,drawing);
      if(drawingApi.exportDrawingModel)drawing.geometryModel=drawingApi.exportDrawingModel(solution);
      result={solution,drawing,brief,suggestedCaseNote:suggestCaseNote(solution.scene)};break;
    }
    default: throw new Error('unsupported domain operation');
  }
  process.stdout.write(JSON.stringify({ok:true,result}));
}catch(error){process.stdout.write(JSON.stringify({ok:false,error:error.message,code:error.code||'DOMAIN_ERROR'}));}
