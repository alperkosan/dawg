import { useState, useEffect, useRef, useCallback } from 'react';

export const usePianoRollWorker = () => {
    const workerRef = useRef(null);
    const [gridLines, setGridLines] = useState(null);
    // Artık tam notalar yerine sadece ID'leri tutan bir Set kullanıyoruz.
    const [visibleNoteIDs, setVisibleNoteIDs] = useState(new Set());
    const pendingTasks = useRef(new Map());

    useEffect(() => {
        const worker = new Worker('/piano_roll_worker.js');
        workerRef.current = worker;

        worker.onmessage = (e) => {
            const { taskId, result, error } = e.data;
            const task = pendingTasks.current.get(taskId);
            if (!task) return;

            if (error) {
                console.error(`Worker error for task ${taskId}:`, error);
                task.reject(error);
            } else {
                // Gelen sonuca göre ilgili state'i güncelliyoruz.
                if (result.type === 'grid') {
                    setGridLines(result.data);
                } else if (result.type === 'visibleNotes') {
                    // Worker'dan gelen ID dizisini bir Set'e çeviriyoruz.
                    setVisibleNoteIDs(new Set(result.data));
                }
                task.resolve(result.data);
            }
            pendingTasks.current.delete(taskId);
        };

        return () => {
            worker.terminate();
        };
    }, []);

    // postTask'ı useCallback ile sarmalayarak her render'da yeniden oluşmasını engelliyoruz.
    // Bu, "Maximum update depth" hatasını çözmeye yardımcı olur.
    const postTask = useCallback((type, params) => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) {
                return reject(new Error("Worker not initialized."));
            }
            const taskId = `${type}-${Date.now()}-${Math.random()}`;
            pendingTasks.current.set(taskId, { resolve, reject });
            workerRef.current.postMessage({ taskId, type, params });
        });
    }, []);

    return { postTask, gridLines, visibleNoteIDs };
};