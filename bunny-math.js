// Positions are in metres; normalize around the eye midpoint, preserving eye orientation.
export function eyePositions(left, right, desiredMetres) {
  const midpoint = left.map((v,i)=>(v+right[i])/2);
  const delta = right.map((v,i)=>v-left[i]);
  const native = Math.hypot(...delta);
  if(native < 1e-8) return {left:[...left],right:[...right],native};
  const offset = delta.map(v=>v/native*desiredMetres/2);
  return {left:midpoint.map((v,i)=>v-offset[i]),right:midpoint.map((v,i)=>v+offset[i]),native};
}
export const presets = {
  toy:{scale:.2,distance:1}, machine:{scale:2,distance:3},
  near:{scale:.25,distance:1}, far:{scale:2,distance:8}
};
