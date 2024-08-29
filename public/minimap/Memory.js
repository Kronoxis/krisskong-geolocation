export class Memory {
    static _size = 100;
    static _data = {};
    static _keys = [];

    static set size(size) {
        Memory._size = size;
        Memory._limit();
    }

    static get size() {
        return Memory._size;
    }

    static has(key) {
        return !!Memory._data[key];
    }

    static get(key) {
        // Make sure key exists
        if (!Memory.has(key)) return null;
        // Push the key to the back
        Memory._refresh();
        // Return value
        return Memory._data[key];
    }

    static store(key, value) {
        // Store the value
        Memory._data[key] = value;
        // Add the key
        Memory._refresh();
        // Constrain to size
        Memory._limit();
    }

    static _refresh(key) {
        // Push the key to the back
        const index = Memory._keys.indexOf(key);
        if (index >= 0) Memory._keys.splice(index, 1);
        Memory._keys.push(key);
    }

    static _limit() {
        // Remove items from the front
        const exceed = Memory._keys.length - Memory._size;
        for (let i = 0; i < exceed; ++i) {
            const del = Memory._keys.shift();
            delete Memory._data[del];
        }
    }
}