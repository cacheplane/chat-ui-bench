/** Threadplane's released native policy pins the viewport within 150 CSS pixels. */
export function hasHistoricalCoverage(evidence: {
    afterGapCssPx: number;
    overlapGapCssPx: number;
    upwardMovementCssPx: number;
    hasAnchor: boolean;
    anchorStillVisible: boolean;
    runtimeUpdated: boolean;
}): boolean {
    return evidence.upwardMovementCssPx > 0 && evidence.afterGapCssPx >= 150 &&
        evidence.overlapGapCssPx >= 150 && evidence.hasAnchor &&
        evidence.anchorStillVisible && evidence.runtimeUpdated;
}
export function hasReturnedToFollowing(evidence:{clicked:boolean;afterVisible:boolean;laterVisible:boolean;afterGapCssPx:number;laterGapCssPx:number;runtimeUpdated:boolean}):boolean{
    return evidence.clicked&&evidence.afterVisible&&evidence.laterVisible&&evidence.afterGapCssPx<150&&evidence.laterGapCssPx<150&&evidence.runtimeUpdated;
}
