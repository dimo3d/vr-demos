export const DURATION=8000;
export const MAX_DELAY=100;
export class Trial {
  constructor(){this.until=0;this.delay=0;}
  start(now,delay){this.delay=Math.max(0,Math.min(MAX_DELAY,delay));this.until=now+DURATION;}
  stop(){this.until=0;}
  active(now){return this.until>now;}
  remaining(now){return Math.max(0,this.until-now);}
}
// Bracket a requested timestamp, interpolating instead of quantizing to old frames.
export function bracket(samples,time){
  if(!samples.length)return null;
  if(time<=samples[0].time)return {a:samples[0],b:samples[0],t:0};
  for(let i=1;i<samples.length;i++)if(samples[i].time>=time){const a=samples[i-1],b=samples[i];return {a,b,t:b.time===a.time?0:(time-a.time)/(b.time-a.time)};}
  const a=samples[samples.length-1];return {a,b:a,t:0};
}
