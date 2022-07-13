export enum RtcPeerStates {
  Invited,
  Answering,
  Connected,
  Disposed,
  
}


export class RtcPeer  {
  peerId: string
  ourId:string
  lastReceive: number
  state:RtcPeerStates;
  peer:RTCPeerConnection|undefined;
  channel: RTCDataChannel|undefined

  invite: string|undefined;
  answer:string|undefined;

  createdAt:number;

  constructor(peerId:string, ourId:string) {
    this.lastReceive = Date.now();
    this.createdAt = Date.now();
    this.peerId = peerId;
    this.ourId = ourId;
    this.state = RtcPeerStates.Invited;

    this.init();
  }

  dispose() {
    if (this.state == RtcPeerStates.Disposed) return;
    this.state = RtcPeerStates.Disposed;
    try {
      this.invite = undefined

      if (this.channel !== undefined) {
        this.channel.close();
        this.channel = undefined;
      }
      if (this.peer !== undefined) {
        this.peer.close();
        this.peer = undefined;
      }      
    } catch (ex) {
      console.error(ex);
    }
  }

  private init() {
    const p = new RTCPeerConnection({
      iceServers: [
        {urls: ['stun:stun.services.mozilla.com']},
        {urls: ['stun:stun.l.google.com:19302']}
      ]
    });
    p.addEventListener(`connectionstatechange`, (evt: Event) => {
      this.log(`connectionstatechange. ${p.connectionState} - ${JSON.stringify(evt)}`);
    });
    p.addEventListener(`icecandidate`, evt => {
      this.log(`icecandidate: ${evt.candidate}`);
    });
    p.addEventListener(`icecandidateerror`, evt => {
      this.log(`icecandidateerror ${JSON.stringify(evt)}`);
    })
    p.addEventListener(`iceconnectionstatechange`, evt => {
      this.log(`iceconnectionstatechange ${p.iceConnectionState}`);
    })
    p.addEventListener(`icegatheringstatechange`, evt => {
      this.log(`icegatheringstatechange ${p.iceGatheringState}`);
    });
    p.addEventListener(`negotiationneeded`, evt => {
      this.log(`negotiationneeded`);
    });
    p.addEventListener(`signalingstatechange`, evt => {
      this.log(`signalingstatechange ${p.signalingState}`);
    })
    p.addEventListener(`track`, evt => {
      this.log(`track`);
    })
    this.peer = p;
  }

  log(m:any) {
    console.log(`Peer[${this.peerId}] `, m);
  }

  async createInvite() {
    const peer = this.peer;
    if (peer === undefined) throw new Error(`Cannot invite while we are not initialised`);

    this.log(`Creating invitation to ${this.peerId}`);

    const ch = peer.createDataChannel(`${this.ourId}-${this.peerId}`);
    ch.addEventListener(`close`, evt => {
      this.log(`channel close`);
    });
    ch.addEventListener(`error`, evt => {
      this.log(`channel error`);
    });
    ch.addEventListener(`open`, evt => {
      this.log(`channel open`);
      this.state = RtcPeerStates.Connected;
    })
    ch.addEventListener(`message`, evt => {
      this.log(`channel message: ${JSON.stringify(evt.data)}`);
    })

    const o = await peer.createOffer({offerToReceiveAudio: false, offerToReceiveVideo: false});
    await peer.setLocalDescription(o);

    const asJson = JSON.stringify(o);
    this.log(`Offer: ${asJson}`);
    this.invite = asJson;
    this.state = RtcPeerStates.Invited;
    this.channel = ch;
    return asJson;
  }

  onNotify(p:any) {
    this.log(`onNotify ${JSON.stringify(p)}`);
    this.lastReceive = Date.now();
  }

  async accept(invite:RTCSessionDescription) {
    if (this.state == RtcPeerStates.Disposed) throw new Error(`Cannot accept whilst disposed`);
    if (this.state == RtcPeerStates.Connected) throw new Error(`Cannot accept whilst connected`);
    const p = this.peer;
    if (p === undefined) throw new Error(`Cannot accept while not initialised`);

    await p.setRemoteDescription(invite);
    const answer = await p.createAnswer();
    await p.setLocalDescription(answer);

    this.log(`accept - assigning answer`);
    this.state = RtcPeerStates.Answering;
    this.answer = JSON.stringify(answer);

  }
}
