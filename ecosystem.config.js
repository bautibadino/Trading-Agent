module.exports = {
  apps: [
    {
      name: 'trading-bot-1m',
      script: 'dist/scripts/ws-futures-ai.js',
      args: '--symbol=ETHUSDT --interval=1m',
      interpreter: 'node',
      node_args: '--dns-result-order=ipv4first',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2/error-1m.log',
      out_file: './logs/pm2/out-1m.log',
      time: true
    },
    {
      name: 'trading-bot-5m',
      script: 'dist/scripts/ws-futures-ai.js',
      args: '--symbol=ETHUSDT --interval=5m',
      interpreter: 'node',
      node_args: '--dns-result-order=ipv4first',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2/error-5m.log',
      out_file: './logs/pm2/out-5m.log',
      time: true
    },
    {
      name: 'trading-bot-15m',
      script: 'dist/scripts/ws-futures-ai.js',
      args: '--symbol=ETHUSDT --interval=15m',
      interpreter: 'node',
      node_args: '--dns-result-order=ipv4first',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2/error-15m.log',
      out_file: './logs/pm2/out-15m.log',
      time: true
    },
    {
      name: 'trading-bot-30m',
      script: 'dist/scripts/ws-futures-ai.js',
      args: '--symbol=ETHUSDT --interval=30m',
      interpreter: 'node',
      node_args: '--dns-result-order=ipv4first',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2/error-30m.log',
      out_file: './logs/pm2/out-30m.log',
      time: true
    },
    {
      name: 'trading-bot-1h',
      script: 'dist/scripts/ws-futures-ai.js',
      args: '--symbol=ETHUSDT --interval=1h',
      interpreter: 'node',
      node_args: '--dns-result-order=ipv4first',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2/error-1h.log',
      out_file: './logs/pm2/out-1h.log',
      time: true
    },
    {
      name: 'trading-bot-4h',
      script: 'dist/scripts/ws-futures-ai.js',
      args: '--symbol=ETHUSDT --interval=4h',
      interpreter: 'node',
      node_args: '--dns-result-order=ipv4first',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2/error-4h.log',
      out_file: './logs/pm2/out-4h.log',
      time: true
    }
  ]
};

