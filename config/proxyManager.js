const fs = require('fs');
const path = require('path');

class ProxyManager {
    constructor(proxyFilePath = path.join(__dirname, 'proxies.txt')) {
        this.proxyFilePath = proxyFilePath;
        this.proxies = [];
        this.loadProxies();
    }

    loadProxies() {
        try {
            const data = fs.readFileSync(this.proxyFilePath, 'utf-8');
            this.proxies = data
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'))
                .map(this.parseProxy)
                .filter(Boolean);
        } catch (err) {
            console.error('Could not load proxies:', err.message);
            this.proxies = [];
        }
    }

    parseProxy(line) {
        const parts = line.split(':');
        if (parts.length === 4) {
            // host:port:user:pass
            return {
                server: `http://${parts[0]}:${parts[1]}`,
                username: parts[2],
                password: parts[3]
            };
        } else if (parts.length === 2) {
            // host:port
            return {
                server: `http://${parts[0]}:${parts[1]}`
            };
        }
        return null;
    }

    getRandomProxy() {
        if (this.proxies.length === 0) return null;
        const idx = Math.floor(Math.random() * this.proxies.length);
        return this.proxies[idx];
    }
}

module.exports = ProxyManager; 