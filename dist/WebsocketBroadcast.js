import { BroadcasterBase } from "./BroadcasterBase";
import { Log } from "./util/Log";
import ReconnectingWebSocket from "./ReconnectingWebsocket";
export class WebsocketBroadcast extends BroadcasterBase {
    constructor(broadcast, serverUrl) {
        super(`ws`, broadcast, Log.fromConfig(broadcast._manager.opts, `ws`, `WebsocketBroadcast`));
        const url = serverUrl ?? (location.protocol === 'http:' ? 'ws://' : 'wss://') + location.host + '/ws';
        this._ws = new ReconnectingWebSocket(url);
        let alrightSeenErrorThankYou = false;
        this._ws.addEventListener(`close`, evt => {
            this._log.verbose(`close`);
            this.setState(`closed`);
        });
        this._ws.addEventListener(`error`, evt => {
            if (evt.message === `TIMEOUT` || alrightSeenErrorThankYou)
                return;
            this._log.warn(`error: ${evt}`);
            alrightSeenErrorThankYou = true;
            this.setState(`error`);
        });
        this._ws.addEventListener(`message`, evt => {
            try {
                const m = JSON.parse(evt.data);
                this._broadcast.onMessage(m, this);
            }
            catch (e) {
                this._log.warn(e);
            }
        });
        this._ws.addEventListener(`open`, evt => {
            alrightSeenErrorThankYou = false;
            this.setState(`open`);
            this._log.verbose(`Connected to ${url}`);
        });
    }
    toString() {
        return `WebsocketBroadcast`;
    }
    maintain() {
    }
    send(payload) {
        payload = this._broadcast._manager.validateOutgoing(payload);
        payload._channel = `ws-bc`;
        this._ws.send(JSON.stringify(payload));
        return true;
    }
}
//# sourceMappingURL=WebsocketBroadcast.js.map