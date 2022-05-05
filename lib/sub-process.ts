import * as childProcess from 'child_process';
import { debug } from './index';

export function execute(command, args, options): Promise<string> {
  const spawnOptions: {
    shell: boolean;
    cwd?: string;
  } = { shell: true };
  if (options && options.cwd) {
    spawnOptions.cwd = options.cwd;
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = childProcess.spawn(command, args, spawnOptions);
    proc.stdout.on('data', (data) => {
      stdout = stdout + data;
    });
    proc.stderr.on('data', (data) => {
      stderr = stderr + data;
    });

    proc.on('error', (err) => {
      debug(`Child process errored with: ${err.message}`);
    });

    proc.on('exit', (code) => {
      debug(`Child process exited with code: ${code}`);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || stdout));
      }
      resolve(stdout || stderr);
    });
  });
}
