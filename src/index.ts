import {Manager, Options} from './Manager.js'
//import './BroadcastChannel.js'

export class Remote {
  _manager;

  constructor(opts:Options) {
    this._manager = new Manager(opts);
    this._manager.addEventListener(`message`, evt => {
      // @ts-ignore
      const d = evt.detail;
      delete d._id;
      delete d._channel;
      this.onData(d);
    })
  }

  get id():string {
    return this._manager.peerId;
  }
  /**
   * Attempts to send data to every known peer, without necessarily
   * saturating broadcast channels
   * @param data 
   * @param to 
   */
  send(data:any, to?:string) {
    this._manager.send(data, to);
  }

  /**
   * Broadcast a message on all available broadcast channels
   * eg web sockets, BroadcastChannel
   * @param data 
   */
  broadcast(data:any) {
    this._manager.broadcast.send(data);
  }

  onData(msg:any) {
    // no-op
  }
}
export {Manager}