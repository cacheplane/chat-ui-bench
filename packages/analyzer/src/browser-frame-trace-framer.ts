import {WireError} from './browser-frame-protobuf-wire.js';

export interface RootFrame {
  frameIndex:number;keyStart:number;keyEnd:number;lengthStart:number;lengthEnd:number;
  bodyStart:number;bodyEnd:number;
}
export interface RootSink {
  start?(frame:RootFrame):void;
  body?(bytes:Uint8Array):void;
  end?(frame:RootFrame):void;
}
/** Internal owned-byte machine. Finish proves a root boundary, never physical EOF. */
export class TraceRootFramer {
  private phase:'key'|'length'|'body'='key';
  private position=0;private value=0n;private octets=0;private remaining=0;
  private frame:RootFrame|null=null;private closed=false;private failed=false;private active=false;
  frames=0;offset:number|undefined;frameIndex:number|undefined;
  constructor(private readonly expectedBytes:number,private readonly frameCap:number,
    private readonly bodyCap:number,private readonly sink:RootSink) {
    if(!Number.isSafeInteger(expectedBytes)||expectedBytes<0||!Number.isInteger(frameCap)||frameCap<1||
      !Number.isInteger(bodyCap)||bodyCap<0)throw new WireError('invalid-framer-profile');
  }
  private completeFrame():void {
    const frame=this.frame!;this.sink.end?.(frame);if(this.failed)throw new WireError('framer-reentry');this.frames++;
    this.frame=null;this.phase='key';this.remaining=0;
  }
  feed(bytes:Uint8Array):void {
    if(this.active){this.failed=true;throw new WireError('framer-reentry');}
    if(this.closed||this.failed)throw new WireError('framer-closed');
    this.active=true;
    try {
      if(bytes.byteLength>this.expectedBytes-this.position)throw new WireError('out-of-bounds-length');
      let at=0;
      while(at<bytes.byteLength){
        if(this.phase==='body'){
          const take=Math.min(this.remaining,bytes.byteLength-at);
          this.sink.body?.(bytes.subarray(at,at+take));if(this.failed)throw new WireError('framer-reentry');at+=take;this.position+=take;this.remaining-=take;
          if(this.remaining===0)this.completeFrame();
          continue;
        }
        if(this.phase==='key'&&this.octets===0){
          this.offset=this.position;this.frameIndex=this.frames;
          if(this.frames>=this.frameCap)throw new WireError('frame-capacity');
          this.frame={frameIndex:this.frames,keyStart:this.position,keyEnd:0,lengthStart:0,lengthEnd:0,bodyStart:0,bodyEnd:0};
        }
        const byte=bytes[at++]!;this.position++;
        if(this.octets===9&&byte>1)throw new WireError('uint64-varint-overflow');
        this.value|=BigInt(byte&127)<<BigInt(this.octets*7);this.octets++;
        if(byte&128){if(this.octets===10)throw new WireError('uint64-varint-overflow');continue;}
        const value=this.value;this.value=0n;this.octets=0;const frame=this.frame!;
        if(this.phase==='key'){
          const field=value>>3n,wire=value&7n;
          if(field<1n||field>536870911n)throw new WireError('invalid-field-number');
          if(wire!==0n&&wire!==1n&&wire!==2n&&wire!==5n)throw new WireError('unsupported-wire-type');
          if(field!==1n||wire!==2n)throw new WireError('unsupported-trace-root-field');
          frame.keyEnd=this.position;frame.lengthStart=this.position;this.phase='length';
        }else{
          // Preserve old eager precedence: remaining whole window precedes body cap.
          if(value>BigInt(this.expectedBytes-this.position))throw new WireError('out-of-bounds-length');
          if(value>BigInt(this.bodyCap))throw new WireError('packet-body-capacity');
          frame.lengthEnd=this.position;frame.bodyStart=this.position;frame.bodyEnd=this.position+Number(value);
          this.remaining=Number(value);this.phase='body';this.sink.start?.(frame);if(this.failed)throw new WireError('framer-reentry');
          if(this.remaining===0)this.completeFrame();
        }
        if(this.failed)throw new WireError('framer-reentry');
      }
    }catch(error){this.failed=true;throw error;}finally{this.active=false;}
  }
  finish():{status:'framed';frames:number;framingBoundaryComplete:true;physicalEOF:false} {
    if(this.active){this.failed=true;throw new WireError('framer-reentry');}
    if(this.closed||this.failed)throw new WireError('framer-closed');
    this.closed=true;
    if(this.phase==='body')throw new WireError('out-of-bounds-length');
    if(this.phase!=='key'||this.octets!==0)throw new WireError('truncated-varint');
    if(this.position!==this.expectedBytes)throw new WireError('out-of-bounds-length');
    return {status:'framed',frames:this.frames,framingBoundaryComplete:true,physicalEOF:false};
  }
}
