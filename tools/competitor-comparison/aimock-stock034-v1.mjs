// Reviewed stock configuration, shared with comparison-threadplane.ts. This guard
// consumes current build evidence; a caller-supplied declaration is insufficient.
export const STOCK034_SOURCE_HASHES_V1=Object.freeze({
 'apps/threadplane/src/app.ts':'9f9680c921700d764c4a5cd312efa12cbbc4940f7c91ef3b34d06fc75017101a',
 'apps/threadplane/src/main.ts':'bf34029550f938e42df33b7323cd11b3db039d9297c85191596404152a4d61fa',
 'apps/threadplane/src/host.ts':'f3293b12a90985b16509cb536000a7d4755b05371d35cc406cfb22289f7d8496',
 'apps/threadplane/angular.json':'2f44e3bbf0d34dbf3c5c9f467d7bee638cca7c4c832d91f1448d2745fbc14838',
 'apps/threadplane/src/index.html':'bdf214c931d38b277ffcfb32f17661db891a4f6219645739334b949331b4a05a',
 'apps/threadplane/src/styles.css':'0b92bab5449a23801ce5e8657b34d94c929682ea9b73f50f01a00443b9139d2b',
});
export const STOCK034_INTEGRITIES_V1=Object.freeze({
 '@threadplane/a2ui':'sha512-NVuiK9atHrCYufQlRwrbDcbVP/Ovfbt85XfnSXPage97CcdvMfjjMRxB4ZE3abwS1yhu5yi+53JBEzWfm1uiwA==',
 '@threadplane/chat':'sha512-XUwGLxixdIeraMZ2ncDnH0nsLujEzmS3WxakrVcREALUfz4nF27zwAiodpP1wOkQ7YOx9aSgwlikzD54qgZAzA==',
 '@threadplane/langgraph':'sha512-rE8dqILnjwLc/Cu1oxknsiJOEU4t7FlVUI78yuWyA4L411nYiKIu94tFOlYLnxfwrm2GSzd0tvHZn76xx5ZuMA==',
 '@threadplane/render':'sha512-jQz+JBbXD85YKNI6nKirMzRHL2mEmccnJkF6niemaXDk2tX9SK3lhnquR81+177ml7JS4OTYWhJLkYRcDVB7Tw==',
 '@threadplane/telemetry':'sha512-nK76GH5WiwCUzkIwdF2J1PkQ0podtG5upXfCwyXjwZN/ZPw+ObU3C+r6wK1JW+pzIf0Zxuc+PoKMu5WFSoIykA==',
});
export function assertStock034BuildV1(build){
 const need=v=>{if(!v)throw Error('aimock-stock034-build-identity');};
 need(build?.production===true&&build.framework?.name==='Angular'&&build.framework.version==='21.2.25'&&build.settings?.optimization===true&&build.settings.sourceMaps===false&&Array.isArray(build.packages));
 for(const [key,hash] of Object.entries(STOCK034_SOURCE_HASHES_V1))need(build.sourceHashes?.[key]===hash);
 for(const [name,integrity] of Object.entries(STOCK034_INTEGRITIES_V1)){
  const rows=build.packages.filter(p=>p.name===name);need(rows.length===1&&rows[0].version==='0.3.4'&&rows[0].integrity===integrity&&rows[0].resolutionPath===`apps/threadplane/node_modules/${name}`);
 }
 return build;
}
