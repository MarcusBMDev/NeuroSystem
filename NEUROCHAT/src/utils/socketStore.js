// src/utils/socketStore.js
let io = null;

module.exports = {
    setIO: (instance) => {
        io = instance;
    },
    getIO: () => {
        return io;
    }
};