import { BroadcasterBase } from "./BroadcasterBase";
import { Log } from "./util/Log";
export class BcBroadcast extends BroadcasterBase {
    constructor(_broadcast) {
        super(`bc`, _broadcast, Log.fromConfig(_broadcast._manager.opts, `bc`, `BcBroadcast`));
        this._bc = new BroadcastChannel(`remote`);
        this._bc.addEventListener(`message`, evt => {
            try {
                const msg = JSON.parse(evt.data);
                this._log.verbose(msg);
                this._broadcast.onMessage(msg, this);
            }
            catch (e) {
                console.error(e);
            }
        });
        setTimeout(() => {
            this.setState(`open`);
        }, 500);
    }
    static isSupported() {
        return (`BroadcastChannel` in self);
    }
    toString() {
        return `BcBroadcast`;
    }
    maintain() {
    }
    send(payload) {
        payload = this._broadcast._manager.validateOutgoing(payload);
        payload._channel = `bc-bc`;
        this._bc.postMessage(JSON.stringify(payload));
        return true;
    }
}
//# sourceMappingURL=BcBroadcast.js.map