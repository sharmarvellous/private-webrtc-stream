export const APP_MODES = {
  CONSOLE: "console",
  SOURCE: "source",
  VIEWER: "viewer"
};

const requestedMode = (import.meta.env.VITE_APP_MODE ?? APP_MODES.CONSOLE).toLowerCase();

export const appMode = Object.values(APP_MODES).includes(requestedMode)
  ? requestedMode
  : APP_MODES.CONSOLE;

export function isSourceApp() {
  return appMode === APP_MODES.SOURCE;
}

export function isViewerApp() {
  return appMode === APP_MODES.VIEWER;
}

export function isConsoleApp() {
  return appMode === APP_MODES.CONSOLE;
}
