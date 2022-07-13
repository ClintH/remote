export class StatusDisplay {
    constructor(manager, opts = {}) {
        this.manager = manager;
        const defaultOpacity = opts.defaultOpacity ?? 0.1;
        const updateRateMs = opts.updateRateMs ?? 5000;
        this.hue = opts.hue ?? 90;
        const e = this._el = document.getElementById(`remote-status`);
        if (e === null)
            return;
        const styleIndicators = (el) => {
            el.style.display = `flex`;
            el.style.alignItems = `center`;
        };
        const bcIndicators = document.createElement(`DIV`);
        bcIndicators.append(this.createIndicator(`ws`, `WebSockets`), this.createIndicator(`bc`, `BroadcastChannel`));
        styleIndicators(bcIndicators);
        e.append(bcIndicators);
        const nodeIndicators = document.createElement(`DIV`);
        styleIndicators(nodeIndicators);
        e.append(nodeIndicators);
        e.style.background = `hsla(${this.hue}, 20%, 50%, 50%)`;
        e.style.color = `hsl(${this.hue}, 50%, 10%)`;
        e.style.border = `1px solid hsla(${this.hue}, 20%, 10%, 50%)`;
        e.style.fontSize = `0.7em`;
        e.style.position = `fixed`;
        e.style.bottom = `0`;
        e.style.right = `0`;
        e.style.padding = `0.3em`;
        e.style.opacity = defaultOpacity.toString();
        e.addEventListener(`pointerover`, () => {
            e.style.opacity = `1.0`;
        });
        e.addEventListener(`pointerout`, () => {
            e.style.opacity = defaultOpacity.toString();
        });
        e.addEventListener(`click`, () => {
            manager.dump();
        });
        manager.broadcast.addEventListener(`change`, evt => {
            const { priorState, newState, source } = evt.detail;
            this.setIndicator(bcIndicators, source.name, newState === `open`, newState);
        });
        manager.peering.addEventListener(`logicalNodeState`, evt => {
            const { priorState, newState, node } = evt.detail;
            this.setIndicator(nodeIndicators, node.id, node.state === `open`, node.dumpSessions());
        });
        manager.peering.addEventListener(`logicalNodeAdded`, evt => {
            const { type, node } = evt.detail;
            nodeIndicators.append(this.createIndicator(node.id, `Node`));
        });
        manager.peering.addEventListener(`logicalNodeRemoved`, evt => {
            const { type, node } = evt.detail;
            const i = this.getIndicator(nodeIndicators, node.id);
            if (i !== null)
                i.remove();
        });
        setInterval(() => {
            const nodes = this.manager.peering.getLogicalNodes();
            const seen = new Set();
            for (const n of nodes) {
                seen.add(n.id);
                let sessions = n.dumpSessions();
                const eph = this.manager.peering.getEphemeral(n.id);
                for (const e of eph) {
                    sessions += '\nSeen on: ' + e.name + ' (' + e.state + ')';
                }
                this.setIndicator(nodeIndicators, n.id, n.state === `open`, sessions);
            }
            const indicators = this.getIndicators(nodeIndicators);
            for (const i of indicators) {
                if (!seen.has(i.getAttribute(`data-for`))) {
                    i.remove();
                }
            }
        }, updateRateMs);
    }
    getIndicators(parent) {
        return Array.from(parent.querySelectorAll(`.remote-indicator`));
    }
    getIndicator(parent, label) {
        return parent.querySelector(`[data-for="${label}"]`);
    }
    setIndicator(parent, label, state, titleAddition = ``) {
        let el = this.getIndicator(parent, label);
        if (el === null) {
            el = this.createIndicator(label, titleAddition);
            parent.append(el);
            return;
        }
        const title = el.getAttribute(`data-title`) + ` ` + titleAddition;
        el.title = title;
        if (state) {
            el.style.border = `1px solid hsla(${this.hue}, 30%, 10%, 50%)`;
        }
        else {
            el.style.border = ``;
        }
    }
    createIndicator(label, title = ``) {
        const ind = document.createElement(`div`);
        ind.innerText = label;
        ind.title = title;
        ind.classList.add(`remote-indicator`);
        ind.setAttribute(`data-for`, label);
        ind.style.padding = `0.3em`;
        ind.setAttribute(`data-title`, title);
        return ind;
    }
}
//# sourceMappingURL=StatusDisplay.js.map