import path from "path";
import chokidar from "chokidar";

export function watchMetrics({ metricsFile, historyDir, onChange }) {
  const targets = [
    metricsFile,
    path.join(historyDir, "*.json"),
  ];

  const watcher = chokidar.watch(targets, {
    ignoreInitial: true,
  });

  let timer = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      onChange();
    }, 200);
  };

  watcher.on("add", schedule);
  watcher.on("change", schedule);

  return watcher;
}
