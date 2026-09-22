/** Public readiness metadata; excludes service paths and management capabilities. */
export type RuntimeStatus = {
  pid: number;
  instanceId: string;
  compiler: 'vite-development';
};
