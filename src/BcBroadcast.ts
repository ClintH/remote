import {Broadcast,IBroadcaster} from "./Broadcast";
import {BroadcasterBase} from "./BroadcasterBase";
import {Log} from "./util/Log";

export class BcBroadcast extends BroadcasterBase implements IBroadcaster {
  private _bc;
  
  constructor(_broadcast:Broadcast) {
    super(`bc`, _broadcast, Log.fromConfig(_broadcast._manager.opts, `bc`, `BcBroadcast`))
    this._bc = new BroadcastChannel(`remote`);
    this._bc.addEventListener(`message`, evt => {
      try {
        const msg = JSON.parse(evt.data);
        this._log.verbose(msg);
        this._broadcast.onMessage(msg, this);
      } catch (e) {
        console.error(e);
      }
    });
    setTimeout(() => {
      this.setState(`open`);
    }, 500);
  }

  static isSupported():boolean {
    return (`BroadcastChannel` in self);
  }


  toString() {
    return `BcBroadcast`;
  }
  
  maintain(): void {
  }

  send(payload:any) {
    if (typeof payload === `string`) {
      payload = {data:payload};
    }
    this._broadcast.ensureId(payload);

    payload._channel = `bc-bc`;
    this._bc.postMessage(JSON.stringify(payload));
    return true;
  }
}