export class BroadcasterBase {
    constructor(_name, _broadcast, _log) {
        this._name = _name;
        this._broadcast = _broadcast;
        this._log = _log;
        this._state = `idle`;
    }
    setState(newState) {
        if (newState == this._state)
            return;
        const priorState = this._state;
        this._state = newState;
        this._log.verbose(priorState + ' -> ' + newState);
        this._broadcast.onBroadcasterState(priorState, newState, this);
    }
    get state() {
        return this._state;
    }
    get name() {
        return this._name;
    }
}
//# sourceMappingURL=BroadcasterBase.js.map