class Speedometer {
    constructor() {
        this.element = document.querySelector("#speedometer");
        this.display = this.element.querySelector("#display");
        this.needle = this.element.querySelector("#needle");
        this._speed = 0;
        this._target = 0;
        this._update = this.update.bind(this);
        this._time = -1;

        this.error = false;

        this.enabled = true;

        this.update();
    }

    get speed() { return this._speed; }
    set speed(speed) { this._target = speed; }

    update(time) {
        if (!this.enabled) return;
        
        if (this.error) {
            this.display.innerHTML = `N/A`;
            this.needle.style.rotate = `-170deg`;
        } else if (this._time > 0) {
            const deltaTime = (time - this._time) * 0.001;
            const t = Math.min(deltaTime, Math.max(deltaTime, 0.001), 0.2);
            this._speed = this._speed * (1 - t) + this._target * t;
            this.display.innerHTML = `${this._speed.toFixed(0)}`;
            this.needle.style.rotate = `${this._speed - 170}deg`;
        }
        this._time = time;
        requestAnimationFrame(this._update);
    }
    
    enable(state) {
        this.enabled = state;
    }
}
const speedometer = new Speedometer();

let websocket = null;
const packetTime = {};
function connect() {
    websocket = new WebSocket(window.SOCKET);
    websocket.addEventListener("open", function () {
        updateInfo();
    });
    websocket.addEventListener("error", function (event) {
        updateInfo();
        console.error("WebSocket error", event);
        connect();
    });
    websocket.addEventListener("close", function () {
        updateInfo();
        if (document.visibilityState !== "visible") return;
        connect();
    });
    websocket.addEventListener("message", function (event) {
        const { data: json } = event;
        const data = JSON.parse(json);
        
        if (packetTime[json.type] && packetTime[json.type] > json.time) return;
        packetTime[json.type] = json.time;
        
        switch (data.type) {
            case "speed":
                const { speed } = data;
                speedometer.speed = Math.min(speed, Math.max(speed, 0), 260);
                break;
            case "enable-speedometer":
                const { enable } = data;
                document.querySelector(".main-container").style.display = enable ? "" : "none";
                speedometer.enable(enable);
                break;
        }
    });
}
connect();

function updateInfo() {
    speedometer.error = !websocket || websocket.readyState !== WebSocket.OPEN;
}
