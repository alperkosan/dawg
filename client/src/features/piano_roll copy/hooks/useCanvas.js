import { useEffect } from 'react';

/**
 * @file useCanvas.js
 * @description Bir canvas elementini yönetmek, yeniden boyutlandırmak ve
 * her animasyon karesinde bir çizim fonksiyonunu çağırmak için kullanılan
 * bir yardımcı React hook'u.
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef - Canvas elementinin referansı.
 * @param {function(CanvasRenderingContext2D, object): void} drawFunction - Her karede çalışacak olan çizim fonksiyonu.
 * @param {object} options - Çizim fonksiyonuna ve hook'a gönderilecek ek veriler (boyutlar, bağımlılıklar vb.).
 */
export const useCanvas = (canvasRef, drawFunction, options = {}) => {
  const { dependencies = [], ...drawOptions } = options;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    let animationFrameId;

    const render = () => {
      // Her render öncesi canvas'ı temizle
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      
      // Kullanıcının sağladığı çizim fonksiyonunu çağır
      drawFunction(context, drawOptions);
      
      // Bir sonraki animasyon karesi için kendini tekrar çağır
      animationFrameId = window.requestAnimationFrame(render);
    };

    render();

    // Component unmount olduğunda animasyon döngüsünü temizle
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [canvasRef, drawFunction, ...dependencies]); // Bağımlılıklar değiştiğinde effect'i yeniden çalıştır
};