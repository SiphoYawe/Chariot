module.exports = {
  apps: [
    {
      name: "chariot-agent",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
      // Graceful shutdown -- allow current cycle to complete
      kill_timeout: 30000,
      listen_timeout: 5000,
    },
  ],
};
