import React, { useState, useEffect } from "react";
import { Music, Play, Volume2, Headphones, Mic, Zap } from "lucide-react";

function StartupScreen({ onStart }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="startup-screen">
      <div className="startup-screen__background">
        <div className="startup-screen__grid"></div>
        <div className="startup-screen__accent-line"></div>
      </div>

      <div className={`startup-screen__content ${isLoaded ? "loaded" : ""}`}>
        <div className="startup-screen__header">
          <div className="startup-screen__logo">
            <Music size={64} strokeWidth={1.5} />
          </div>
          <h1 className="startup-screen__title">DAWG</h1>
          <div className="startup-screen__subtitle">
            <span className="startup-screen__tagline">
              Digital Audio Workstation
            </span>
            <span className="startup-screen__description">
              Profesyonel müzik prodüksiyonu için tasarlandı
            </span>
          </div>
        </div>

        <div className="startup-screen__features">
          <div className="startup-screen__feature">
            <div className="startup-screen__feature-icon">
              <Volume2 size={18} />
            </div>
            <span>Gelişmiş Ses İşleme</span>
          </div>
          <div className="startup-screen__feature">
            <div className="startup-screen__feature-icon">
              <Headphones size={18} />
            </div>
            <span>Gerçek Zamanlı Monitörleme</span>
          </div>
          <div className="startup-screen__feature">
            <div className="startup-screen__feature-icon">
              <Mic size={18} />
            </div>
            <span>Çoklu Kayıt Desteği</span>
          </div>
        </div>

        <button onClick={onStart} className="startup-screen__button">
          <Play size={20} />
          <span>Stüdyoya Gir</span>
        </button>
      </div>
    </div>
  );
}

export default StartupScreen;
