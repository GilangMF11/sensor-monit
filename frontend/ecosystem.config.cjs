module.exports = {
  apps: [
    {
      name: 'frontend',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 4173',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
