import {BroadcasterState, Broadcast, IBroadcaster} from "./Broadcast";
import {Log} from "./util/Log";

export abstract class BroadcasterBase implements IBroadcaster {
  private _state:BroadcasterState;

  constructor(readonly _name:string, readonly _broadcast:Broadcast, readonly _log:Log) {
    this._state = `idle`;
  }

  setState(newState:BroadcasterState) {
    if (newState == this._state) return;
    const priorState = this._state;
    this._state = newState;
    this._log.verbose(priorState + ' -> ' + newState);
    this._broadcast.onBroadcasterState(priorState, newState, this);
  }

  get state():BroadcasterState {
    return this._state;
  }

  abstract maintain(): void;
  abstract send(payload: any): boolean;

  get name() {
    return this._name;
  }
}