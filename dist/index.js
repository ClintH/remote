import { Manager } from './Manager.js';
export class Remote {
    constructor(opts) {
        this._manager = new Manager(opts);
        this._manager.addEventListener(`message`, evt => {
            const d = evt.detail;
            delete d._id;
            delete d._channel;
            this.onData(d);
        });
    }
    get id() {
        return this._manager.peerId;
    }
    send(data, to) {
        this._manager.send(data, to);
    }
    broadcast(data) {
        this._manager.broadcast.send(data);
    }
    onData(msg) {
    }
}
export { Manager };
//# sourceMappingURL=index.js.map