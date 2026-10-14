module.exports = {
  apps: [
    {
      name: 'nse-backend',
      script: '.venv/Scripts/python.exe',
      args: '-m uvicorn nse_pipeline.api.app:app --host 0.0.0.0 --port 8000',
      cwd: './',
      autorestart: true,
      max_restarts: 10,
      env: {
        PYTHONPATH: './src',
      },
    },
    {
      name: 'nse-scheduler',
      script: '.venv/Scripts/python.exe',
      args: '-m nse_pipeline.scheduler.daily_scheduler',
      cwd: './',
      autorestart: true,
      max_restarts: 10,
      env: {
        PYTHONPATH: './src',
      },
    },
    {
      name: 'nse-frontend',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 3000',
      cwd: './frontend',
      autorestart: true,
    },
  ],
};
