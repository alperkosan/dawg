import { useState, useEffect, useRef } from 'react';

// Web Worker ile iletişim kuran ve hesaplama sonuçlarını yöneten merkezi hook.
export const usePianoRollWorker = () => {
    const workerRef = useRef(null);
    // Worker'dan gelen hesaplanmış verileri saklayacak state'ler
    const [gridLines, setGridLines] = useState(null);
    const [visibleNotes, setVisibleNotes] = useState([]);
    const [pendingTasks, setPendingTasks] = useState(new Map());

    // Component yüklendiğinde worker'ı bir kere başlatıyoruz.
    useEffect(() => {
        // Worker'ı public klasöründen yüklüyoruz.
        const worker = new Worker('/piano_roll_worker.js');
        workerRef.current = worker;

        // Worker'dan bir mesaj geldiğinde bu fonksiyon çalışır.
        worker.onmessage = (e) => {
            const { taskId, result, error } = e.data;
            if (error) {
                console.error(`Worker error for task ${taskId}:`, error);
                pendingTasks.get(taskId)?.reject(error);
            } else {
                // Gelen sonuca göre ilgili state'i güncelliyoruz.
                if (result.vertical || result.horizontal) {
                    setGridLines(result);
                } else {
                    // Şimdilik diğer sonuçları (visibleNotes vb.) buraya ekleyeceğiz.
                    // Bu örnekte grid'e odaklanıyoruz.
                }
                pendingTasks.get(taskId)?.resolve(result);
            }
            setPendingTasks(prev => {
                const newTasks = new Map(prev);
                newTasks.delete(taskId);
                return newTasks;
            });
        };

        // Component kaldırıldığında worker'ı sonlandırıyoruz.
        return () => {
            worker.terminate();
        };
    }, []); // Boş bağımlılık dizisi, bu effect'in sadece bir kere çalışmasını sağlar.

    // Worker'a yeni bir görev göndermek için kullanacağımız fonksiyon.
    const postTask = (type, params) => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) {
                reject(new Error("Worker is not initialized."));
                return;
            }
            const taskId = `${type}-${Date.now()}-${Math.random()}`;
            setPendingTasks(prev => new Map(prev).set(taskId, { resolve, reject }));
            workerRef.current.postMessage({ taskId, type, params });
        });
    };

    return { postTask, gridLines, visibleNotes };
};