export class CapabilityScheduler {
  constructor(options={}) { this.registry=options.registry; if(!this.registry?.available) throw new Error('CapabilityScheduler需要Capability Registry'); }
  plan(interpretation) {
    if (interpretation.taskType==='clarification'||interpretation.confidence<0.65) throw new Error('低置信度任务必须在进入Scheduler前澄清');
    const preauthorized=interpretation.context?.preauthorized===true||interpretation.context?.scope==='controlled_test';
    if (interpretation.requiresConfirmation || (!preauthorized&&interpretation.requiredCapabilities.some((capabilityId)=>{
      const entries=this.registry.find?.(capabilityId)||[];
      return entries.some((entry)=>entry.requiresConfirmation||entry.riskLevel==='high');
    }))) return {status:'needs_confirmation',interpretation,assignments:[],missingCapabilities:[]};
    const assignments=[]; const missingCapabilities=[];
    for (const capabilityId of interpretation.requiredCapabilities) {
      const providers=this.registry.available(capabilityId);
      if(!providers.length){missingCapabilities.push(capabilityId);continue;}
      const ranked=[...providers].sort((a,b)=>this.score(b,interpretation)-this.score(a,interpretation));
      assignments.push({capabilityId,primaryProvider:ranked[0],fallbackProviders:ranked.slice(1)});
    }
    return {status:missingCapabilities.length?'capability_unavailable':'ready',interpretation,assignments,missingCapabilities};
  }
  score(provider,interpretation) {
    const riskPenalty={low:0,medium:15,high:50}[provider.riskLevel]||0;
    const confirmationPenalty=provider.requiresConfirmation&&!interpretation.requiresConfirmation?25:0;
    return Number(provider.historicalSuccessRate||0)*100-Number(provider.estimatedLatency||0)/1000-Number(provider.estimatedCost||0)-riskPenalty-confirmationPenalty;
  }
}
