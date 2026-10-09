function getTaskColorIndex(
  taskId: string,
): 0 | 1 {
  let hash = 0

  for (const character of taskId) {
    hash =
      (
        hash * 31 +
        character.charCodeAt(0)
      ) >>> 0
  }

  return hash % 2 === 0
    ? 0
    : 1
}

export function getMemoryTaskColorClass(
  taskId: string,
): string {
  return `memory-cell--task${getTaskColorIndex(taskId)}`
}

export function getProcessingTaskColorClass(
  taskId: string,
): string {
  return `processing-dot--task${getTaskColorIndex(taskId)}`
}
