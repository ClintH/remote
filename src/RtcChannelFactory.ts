import {IChannel, IChannelFactory} from "./IChannel";
import {IBroadcaster} from "./Broadcast";
import {PeeringInvite} from "./Peering";
import {IPeeringSessionImpl, PeeringSession} from "./PeeringSession";
import {Log} from "./util/Log";

class RtcPeeringSession implements IPeeringSessionImpl {
  _pc:RTCPeerConnection;
  _log:Log;
  _dc:RTCDataChannel|undefined;

  _onDisposingH;
  _onReplyH;
  _onSendH;

  constructor(readonly session:PeeringSession) {
    this._pc = new RTCPeerConnection({
      iceServers: [
        {urls: ['stun:stun.services.mozilla.com']},
        {urls: ['stun:stun.l.google.com:19302']}
      ]
    });
    this._log = Log.fromConfig(session.manager.opts, `rtc`, `RtcPeeringSession`);
    
    this._onDisposingH = this.onDisposing.bind(this);
    this._onReplyH = this.onReply.bind(this);
    this._onSendH = this.onSend.bind(this);
    
    // @ts-ignore
    session.addEventListener(`reply`, this._onReplyH);
    session.addEventListener(`disposing`,this._onDisposingH);
    session.addEventListener(`send`,this._onSendH);
  }

  /**
   * Sends data to remote peer
   * @param data 
   */
  onSend(evt:Event) {
    const data = (evt as CustomEvent).detail;
    if (this._dc) {
      console.log(`RTC Sending`, data);
      this._dc.send(JSON.stringify(data));
    } else {
      this.warn(`Cannot send without data channel`);
    }
  }

  onDisposing() {
    this._log.verbose(`onDisposing`);
    // @ts-ignore
    this.session.removeEventListener(`reply`, this._onReplyH);
    this.session.removeEventListener(`disposing`,this._onDisposingH);

  }

  onReply(evt:CustomEvent) {
    const { reply, bc} = evt.detail;
    const subKind = reply.sub;
    switch (subKind) {
      case `rtc-accept`:
        try {
          const descr = JSON.parse(reply.payload);
          this._pc.setRemoteDescription(descr);
        } catch (ex) {
          this.warn(ex);
        }
        break;
      case `rtc-ice`:
        try {
        const c = new RTCIceCandidate({
          sdpMLineIndex: (reply as any).label,
          candidate: (reply as any).candidate
        });
        this._pc.addIceCandidate(c);
        } catch (ex) {
          this.warn(ex);
          this.warn(reply);
        }
        break;
      default:
        this._log.verbose(`Cannot handle reply ${subKind}`);
    }
  }


  warn(msg:any) {
    console.warn(`RtcPeeringSession`, msg);
  }

  async start() {
    //this.log(`Start`);
    const p  = this._pc;
    const dc = this._pc.createDataChannel(`${this.session.remotePeer}`);
    this.setupDataChannel(dc);
    p.addEventListener(`icecandidate`, evt => {
      //this.log(`ice candidate`);
      const c = evt.candidate;
      if (c === null) return;
      this.session.broadcastReply(`peering-reply`,{
        sub: `rtc-ice`,
        peeringSessionId: this.session.id,
        label: c.sdpMLineIndex,
        id: c.sdpMid,
        candidate: c.candidate
      });
    });
    p.addEventListener(`close`, evt => {
      this._log.verbose(`channel close`);
    });
    p.addEventListener(`error`, evt => {
      this._log.verbose(`channel error`);
    });
    p.addEventListener(`open`, evt => {
      this._log.verbose(`channel open`);
    })
    p.addEventListener(`message`, evt => {
      this._log.verbose(`channel message: ${JSON.stringify(evt)}`);
      // } catch (e) {
      //   this._log.warn(`Could not parse: ${evt}`);
      // }
    })


    this._pc = p;

    const o = await p.createOffer({offerToReceiveAudio: false, offerToReceiveVideo: false});
    await p.setLocalDescription(o);
    const invite:PeeringInvite = {
      invitee: this.session.remotePeer,
      inviter: this.session.manager.peerId,
      channel: `rtc`,
      peeringSessionId: this.session.id,
      payload: JSON.stringify(o)
    };
    this.session.broadcastReply(`peering-invite`, invite);
  }

  setupDataChannel(dc:RTCDataChannel) {
    this._dc = dc;
    dc.addEventListener(`close`, evt => {
      this._log.verbose(`dc close`);
      this.session.onClosed(`data channel closed`);
    })

    dc.addEventListener(`closing`, evt => {
      this._log.verbose(`dc closing`);
    });

    dc.addEventListener(`error`, evt => {
      this._log.verbose(`dc error`);
    })

    dc.addEventListener(`message`, evt => {
      //this._log.verbose(`dc message: ${evt.data}`);
      try {
        const o = JSON.parse(evt.data);
        this.session.onMessageReceived(o, this);
      } catch(e) {
        this._log.warn(`Could not parse: ${evt.data}`);
      }
    });

    dc.addEventListener(`open`, evt => {
      this._log.verbose(`dc open`);
      this.session.onOpened();
    })
  }
  acceptInvitation(i :PeeringInvite) {
    this._log.verbose(`Accept invitation from ${i.inviter}`);
    try {
      const payload = JSON.parse(i.payload);
      const p = this._pc;
      p.addEventListener(`datachannel`, evt => {
        this._log.verbose(`Data channel created!`);
        this.setupDataChannel(evt.channel);
      });
      p.setRemoteDescription(payload);
      p.createAnswer().then(descr => {
        p.setLocalDescription(descr);

        this.session.broadcastReply(`peering-reply`, {
          invitee: i.invitee,
          sub: `rtc-accept`,
          peeringSessionId: this.session.id,
          inviter: i.inviter,
          payload: JSON.stringify(descr)
        })
      });

    } catch (ex) {
      console.warn(ex);
    }
  }
}

export class RtcChannelFactory implements IChannelFactory {
  constructor() {

  }

  get name() {
    return `rtc`;
  }

  maintain() {

  }

  acceptInvitation(i: PeeringInvite, session:PeeringSession, bc: IBroadcaster): void {
    const s = new RtcPeeringSession(session);
    s.acceptInvitation(i);
  }

  initiatePeering(remoteId: string, session: PeeringSession): void {
    const s = new RtcPeeringSession(session);
    s.start();
  }

}

export class RtcChannel implements IChannel {
  constructor() {

  }

  get name() {
    return `rtc`;
  }

  maintain() {

  }
}